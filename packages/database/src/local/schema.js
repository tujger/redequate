import {openDatabase} from "./connection";
import {LOCAL_SCHEMA} from "./storeSchema";

const incompatible = message => Object.assign(new Error(message), {name: "VersionError"});
const validPath = path => {
    if (typeof path === "string") return path.length > 0;
    return Array.isArray(path) && path.length > 0 &&
        path.every(part => typeof part === "string" && part.length > 0);
};
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const normalize = (schema, requiredSchema) => {
    if (!plain(schema) || !Object.keys(schema).length) throw new TypeError("Local schema must be a non-empty object of stores.");
    const stores = Object.create(null);
    for (const [name, definition] of Object.entries(schema)) {
        if (name.startsWith("$") || !name || !plain(definition) || !validPath(definition.keyPath) ||
            typeof definition.autoIncrement !== "boolean" || !plain(definition.indexes)) {
            throw new TypeError(`Invalid Local store schema: ${name}`);
        }
        if (definition.autoIncrement && Array.isArray(definition.keyPath)) {
            throw new TypeError(`Auto-increment needs a string keyPath: ${name}`);
        }
        const indexes = Object.create(null);
        for (const [index, description] of Object.entries(definition.indexes)) {
            if (!index || !plain(description) || !validPath(description.keyPath) ||
                (description.unique !== undefined && typeof description.unique !== "boolean") ||
                (description.multiEntry !== undefined && typeof description.multiEntry !== "boolean") ||
                (description.multiEntry && Array.isArray(description.keyPath))) {
                throw new TypeError(`Invalid Local index schema: ${name}.${index}`);
            }
            indexes[index] = {
                keyPath: structuredClone(description.keyPath), unique: description.unique ?? false,
                ...(description.multiEntry ? {multiEntry: true} : {})
            };
            const required = Object.hasOwn(requiredSchema, name) && Object.hasOwn(requiredSchema[name].indexes, index)
                ? requiredSchema[name].indexes[index]
                : undefined;
            if (required && !same(indexes[index], required)) {
                throw incompatible(`Local index ${name}.${index} is required by the framework.`);
            }
        }
        stores[name] = {keyPath: structuredClone(definition.keyPath), autoIncrement: definition.autoIncrement, indexes};
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
            store.index(index).unique !== spec.unique || store.index(index).multiEntry !== !!spec.multiEntry);
        if (indexes.length) changes.push([name, definition, indexes]);
    }
    return changes;
};

const upgrade = (storageId, version, schema) => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(storageId, version);
    let failure;
    let blocked = false;
    request.onupgradeneeded = () => {
        if (blocked) {
            request.transaction.abort();
            return;
        }
        const transaction = request.transaction;
        transaction.addEventListener("abort", () => { failure ??= transaction.error; });
        try {
            // Check every store before changing anything. An abort rolls back all index work.
            const changes = changesFor(request.result, schema, request.transaction);
            for (const [name, definition, indexes] of changes) {
                const store = indexes === null
                    ? request.result.createObjectStore(name, {keyPath: definition.keyPath, autoIncrement: definition.autoIncrement})
                    : request.transaction.objectStore(name);
                for (const [index, spec] of indexes ?? Object.entries(definition.indexes)) {
                    if (store.indexNames.contains(index)) store.deleteIndex(index);
                    store.createIndex(index, spec.keyPath, {unique: spec.unique, multiEntry: spec.multiEntry ?? false});
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

/** Apply only declared schema changes atomically. */
export const applySchema = async (storageId, input, initialSchema = LOCAL_SCHEMA) => {
    const schema = normalize(input, initialSchema);
    for (let attempt = 0; attempt < 10; attempt++) {
        const database = await openDatabase(storageId, initialSchema);
        let version;
        try {
            if (!changesFor(database, schema).length) return;
            version = database.version;
        } finally { database.close(); }
        try {
            await upgrade(storageId, version + 1, schema);
        } catch (error) {
            // Another tab may have upgraded between inspection and versionchange.
            if (error?.name !== "VersionError" || attempt === 9) throw error;
        }
    }
    throw new Error("Local schema did not converge after concurrent upgrades.");
};
