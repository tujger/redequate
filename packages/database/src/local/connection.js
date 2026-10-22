import {LOCAL_SCHEMA} from "./storeSchema";
import {IDENTITY_INDEX} from "./row";

const openVersionedDatabase = (storageKey, version, schema) => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(`redequate:local:${storageKey}`, version);
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
export const openDatabase = async (storageKey, initialSchema = LOCAL_SCHEMA) => {
    let database;
    try {
        try {
            database = await openVersionedDatabase(storageKey, 1, initialSchema);
        } catch (error) {
            if (error?.name !== "VersionError") throw error;
            database = await openVersionedDatabase(storageKey, undefined, initialSchema);
        }
        const incompatible = !Object.keys(LOCAL_SCHEMA).some(name => database.objectStoreNames.contains(name)) ||
            Object.entries(LOCAL_SCHEMA).some(([name, definition]) => {
                if (!database.objectStoreNames.contains(name)) return false;
                const store = database.transaction(name).objectStore(name);
                if (store.keyPath !== definition.keyPath || store.autoIncrement !== definition.autoIncrement ||
                    !store.indexNames.contains("_identity")) return true;
                const index = store.index("_identity");
                const path = JSON.stringify(index.keyPath);
                return !index.unique || index.multiEntry ||
                    (path !== JSON.stringify(IDENTITY_INDEX.keyPath) &&
                        path !== JSON.stringify(["_local._collection", "_local._key"]));
            });
        if (incompatible) throw Object.assign(new Error("Existing Local database has an incompatible schema."), {name: "VersionError"});
        return database;
    } catch (error) {
        database?.close();
        if (error?.name !== "VersionError") throw error;
        const message = `Existing redequate:local:${storageKey} IndexedDB database has an incompatible Local schema; repair it explicitly before opening.`;
        throw Object.assign(new Error(message, {cause: error}), {name: "VersionError"});
    }
};
