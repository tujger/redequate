export const LOCAL_DATABASE_NAME = "redequate:local";

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const incompatible = name => Object.assign(new Error(`Local service store ${name} has an incompatible schema.`), {name: "VersionError"});

const serviceChanges = (database, schema, transaction) => {
    const changes = [];
    for (const [name, definition] of Object.entries(schema)) {
        if (!database.objectStoreNames.contains(name)) {
            changes.push([name, definition, null]);
            continue;
        }
        const store = transaction ? transaction.objectStore(name) : database.transaction(name).objectStore(name);
        if (!same(store.keyPath, definition.keyPath) || store.autoIncrement !== definition.autoIncrement) {
            throw incompatible(name);
        }
        const indexes = Object.entries(definition.indexes).filter(([index, spec]) =>
            !store.indexNames.contains(index) || !same(store.index(index).keyPath, spec.keyPath) ||
            store.index(index).unique !== spec.unique || store.index(index).multiEntry !== !!spec.multiEntry);
        if (indexes.length) changes.push([name, definition, indexes]);
    }
    return changes;
};

const applyServiceSchema = (database, schema, transaction) => {
    const changes = serviceChanges(database, schema, transaction);
    for (const [name, definition, indexes] of changes) {
        const store = indexes === null
            ? database.createObjectStore(name, {keyPath: definition.keyPath, autoIncrement: definition.autoIncrement})
            : transaction.objectStore(name);
        for (const [index, spec] of indexes ?? Object.entries(definition.indexes)) {
            if (store.indexNames.contains(index)) store.deleteIndex(index);
            store.createIndex(index, spec.keyPath, {unique: spec.unique, multiEntry: spec.multiEntry ?? false});
        }
    }
};

const openConnection = (storageId, schema, version) => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(storageId, version);
    let blocked = false, failure;
    request.onupgradeneeded = () => {
        if (blocked) { request.transaction.abort(); return; }
        try {
            applyServiceSchema(request.result, schema, request.transaction);
        } catch (error) {
            failure = error;
            request.transaction.abort();
        }
    };
    request.onerror = () => reject(failure ?? request.error);
    request.onblocked = () => {
        blocked = true;
        reject(new Error("Local database upgrade is blocked."));
    };
    request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        if (blocked) database.close();
        else resolve(database);
    };
});

export const openLocalDatabase = async (storageId = LOCAL_DATABASE_NAME, schema = {}) => {
    for (let attempt = 0; attempt < 10; attempt++) {
        const database = await openConnection(storageId, schema);
        let version;
        try {
            if (!serviceChanges(database, schema).length) return database;
            version = database.version;
        } catch (error) {
            database.close();
            throw error;
        }
        database.close();
        try {
            const upgraded = await openConnection(storageId, schema, version + 1);
            upgraded.close();
        } catch (error) {
            if (error?.name !== "VersionError" || attempt === 9) throw error;
        }
    }
    throw new Error("Local service schema did not converge after concurrent upgrades.");
};
