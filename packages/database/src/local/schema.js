import {openDatabase} from "./helpers";
import {LOCAL_SCHEMA} from "./constants";

const incompatible = message => Object.assign(new Error(message), {name: "VersionError"});
const validPath = path => {
    if (typeof path === "string") return path.length > 0;
    return Array.isArray(path) && path.length > 0 &&
        path.every(part => typeof part === "string" && part.length > 0);
};
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const normalize = schema => {
    if (!plain(schema) || !Object.keys(schema).length) throw new TypeError("Local schema must be a non-empty object of stores.");
    const stores = {};
    for (const [name, definition] of Object.entries(schema)) {
        if (!name || !plain(definition) || !validPath(definition.keyPath) ||
            typeof definition.autoIncrement !== "boolean" || !plain(definition.indexes)) {
            throw new TypeError(`Invalid Local store schema: ${name}`);
        }
        if (definition.autoIncrement && Array.isArray(definition.keyPath)) {
            throw new TypeError(`Auto-increment needs a string keyPath: ${name}`);
        }
        const indexes = {};
        for (const [index, description] of Object.entries(definition.indexes)) {
            if (!index || !plain(description) || !validPath(description.keyPath) ||
                (description.unique !== undefined && typeof description.unique !== "boolean")) {
                throw new TypeError(`Invalid Local index schema: ${name}.${index}`);
            }
            indexes[index] = {keyPath: description.keyPath, unique: description.unique ?? false};
            const required = LOCAL_SCHEMA[name]?.indexes[index];
            if (required && !same(indexes[index], required)) {
                throw incompatible(`Local index ${name}.${index} is required by the framework.`);
            }
        }
        stores[name] = {keyPath: definition.keyPath, autoIncrement: definition.autoIncrement, indexes};
    }
    return stores;
};

const changesFor = (database, schema, transaction) => {
    const changes = [];
    for (const [name, definition] of Object.entries(schema)) {
        if (!database.objectStoreNames.contains(name)) {
            changes.push([name, definition, null]);
            continue;
        }
        const store = transaction ? transaction.objectStore(name) : database.transaction(name).objectStore(name);
        if (!same(store.keyPath, definition.keyPath) || store.autoIncrement !== definition.autoIncrement) {
            throw incompatible(`Local store ${name} has an incompatible keyPath or autoIncrement setting.`);
        }
        const indexes = Object.entries(definition.indexes).filter(([index, spec]) =>
            !store.indexNames.contains(index) || !same(store.index(index).keyPath, spec.keyPath) ||
            store.index(index).unique !== spec.unique);
        if (indexes.length) changes.push([name, definition, indexes]);
    }
    return changes;
};

const upgrade = (storageKey, version, schema) => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(`redequate:local:${storageKey}`, version);
    let failure;
    let blocked = false;
    request.onupgradeneeded = () => {
        if (blocked) {
            request.transaction.abort();
            return;
        }
        try {
            // Check every store before changing anything. An abort rolls back all index work.
            const changes = changesFor(request.result, schema, request.transaction);
            for (const [name, definition, indexes] of changes) {
                const store = indexes === null
                    ? request.result.createObjectStore(name, {keyPath: definition.keyPath, autoIncrement: definition.autoIncrement})
                    : request.transaction.objectStore(name);
                for (const [index, spec] of indexes ?? Object.entries(definition.indexes)) {
                    if (store.indexNames.contains(index)) store.deleteIndex(index);
                    store.createIndex(index, spec.keyPath, {unique: spec.unique});
                }
            }
        } catch (error) {
            failure = error;
            request.transaction.abort();
        }
    };
    request.onblocked = () => {
        blocked = true;
        reject(new Error("Local database upgrade is blocked by another open connection."));
    };
    request.onerror = () => reject(failure ?? request.error);
    request.onsuccess = () => {
        request.result.close();
        if (!blocked) resolve();
    };
});

/** Add stores and indexes atomically. Existing unspecified stores and indexes stay in place. */
export const applySchema = async (storageKey, input) => {
    const schema = normalize(input);
    for (let attempt = 0; attempt < 10; attempt++) {
        const database = await openDatabase(storageKey);
        let version;
        try {
            if (!changesFor(database, schema).length) return;
            version = database.version;
        } finally { database.close(); }
        try {
            await upgrade(storageKey, version + 1, schema);
        } catch (error) {
            // Another tab may have upgraded between inspection and versionchange.
            if (error?.name !== "VersionError" || attempt === 9) throw error;
        }
    }
    throw new Error("Local schema did not converge after concurrent upgrades.");
};
