import {LOCAL_SCHEMA} from "./storeSchema";

const openVersionedDatabase = (storageId, version, schema) => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(storageId, version);
    let blocked = false;
    request.onupgradeneeded = () => {
        if (blocked) { request.transaction.abort(); return; }
        for (const [name, definition] of Object.entries(schema)) {
            const store = request.result.createObjectStore(name, {keyPath: definition.keyPath, autoIncrement: definition.autoIncrement});
            for (const [index, spec] of Object.entries(definition.indexes)) {
                store.createIndex(index, spec.keyPath, {unique: spec.unique, multiEntry: spec.multiEntry ?? false});
            }
        }
    };
    request.onerror = () => reject(request.error);
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

// Opening validates the storage model. JSON additions are handled by applySchema.
export const openDatabase = async (storageId, initialSchema = LOCAL_SCHEMA) => {
    let database;
    try {
        database = await openVersionedDatabase(storageId, undefined, initialSchema);
        const hasKnownStore = [...database.objectStoreNames].some(name =>
            name.startsWith("$") || Object.hasOwn(initialSchema, name));
        const incompatible = (database.objectStoreNames.length > 0 && !hasKnownStore) ||
            Object.entries(LOCAL_SCHEMA).some(([name, definition]) => {
                if (!database.objectStoreNames.contains(name)) return false;
                const store = database.transaction(name).objectStore(name);
                return store.keyPath !== definition.keyPath || store.autoIncrement !== definition.autoIncrement;
            });
        if (incompatible) throw Object.assign(new Error("Existing Local database has an incompatible schema."), {name: "VersionError"});
        return database;
    } catch (error) {
        database?.close();
        if (error?.name !== "VersionError") throw error;
        const message = `Existing ${storageId} IndexedDB database has an incompatible Local schema; repair it explicitly before opening.`;
        throw Object.assign(new Error(message, {cause: error}), {name: "VersionError"});
    }
};
