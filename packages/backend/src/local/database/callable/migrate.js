import {fail} from "../../../../../common";
import {openLocalDatabase} from "../../../../../common/src/localDatabase";
import {LOCAL_SCHEMA} from "../../../../../database/src/local/storeSchema";
import {notifyWrites} from "./createHelpers";

const invalid = message => fail("database/invalid-argument", message);
const fieldName = value => typeof value === "string" && /^[A-Za-z_$][\w$]*$/.test(value) &&
    !["_id", "__proto__", "constructor", "prototype"].includes(value);

const migrateTransaction = (transaction, collection, sourceField, targetField, obsolete, resolve, reject) => {
    const store = transaction.objectStore(collection);
    let failure, counts;
    transaction.oncomplete = () => resolve(counts);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Migration aborted."));
    const abort = error => { failure = error; transaction.abort(); };
    if (![...store.indexNames].some(name => {
        const index = store.index(name);
        return index.keyPath === targetField && index.unique && !index.multiEntry;
    })) {
        abort(new Error(`No single-field unique index for ${collection}.${targetField}.`));
        return;
    }
    const request = store.getAll();
    request.onerror = () => { failure = request.error; };
    request.onsuccess = () => {
        try {
            const rows = request.result;
            const used = new Set(rows.filter(row => row[targetField] != null).map(row => row[targetField]));
            const pending = [];
            for (const row of rows) {
                if (row[targetField] != null) continue;
                const key = row[sourceField];
                if (typeof key !== "string" || !key.trim()) {
                    throw new Error(`Record _id=${row._id} has no valid ${sourceField} key.`);
                }
                if (used.has(key)) throw new Error(`Record _id=${row._id} conflicts on ${targetField}: ${key}`);
                used.add(key);
                pending.push({...row, [targetField]: key});
            }
            counts = {scanned: rows.length, repaired: pending.length, unchanged: rows.length - pending.length};
            for (const name of obsolete) store.deleteIndex(name);
            for (const row of pending) {
                const write = store.put(row);
                write.onerror = () => { failure = new Error(`Record _id=${row._id}: ${write.error?.message}`); };
            }
        } catch (error) { abort(error); }
    };
};

export default async function migrate({storageId, args}) {
    const options = args[0];
    if (args.length !== 1 || !options || typeof options !== "object" || Array.isArray(options)) {
        invalid("Expected ({collection, sourceField, targetField}).");
    }
    const {collection, sourceField, targetField} = options;
    if (typeof collection !== "string" || !collection || collection.startsWith("$") || collection.includes("/")) {
        invalid("collection must name a Local collection.");
    }
    if (!fieldName(sourceField) || !fieldName(targetField) || sourceField === targetField) {
        invalid("Expected distinct top-level field names other than _id.");
    }
    const database = await openLocalDatabase(storageId);
    let result;
    try {
        if (!database.objectStoreNames.contains(collection)) invalid(`Unknown Local collection: ${collection}`);
        const store = database.transaction(collection).objectStore(collection);
        const declared = LOCAL_SCHEMA[collection]?.indexes;
        const obsolete = [...store.indexNames].filter(name => {
            const path = store.index(name).keyPath;
            return declared && !Object.hasOwn(declared, name) &&
                (Array.isArray(path) ? path.includes(sourceField) : path === sourceField);
        });
        if (!obsolete.length) {
            result = await new Promise((resolve, reject) => migrateTransaction(
                database.transaction(collection, "readwrite"), collection, sourceField, targetField, [], resolve, reject));
        } else {
            const version = database.version;
            database.close();
            result = await new Promise((resolve, reject) => {
                const request = globalThis.indexedDB.open(storageId, version + 1);
                let failure, counts, blocked = false;
                request.onblocked = () => {
                    blocked = true;
                    reject(new Error("Migration is blocked by another open database connection. Close it and retry."));
                };
                request.onupgradeneeded = () => {
                    if (blocked) { request.transaction.abort(); return; }
                    migrateTransaction(request.transaction, collection, sourceField, targetField, obsolete,
                        value => { counts = value; }, error => { failure = error; });
                };
                request.onerror = () => reject(failure ?? request.error);
                request.onsuccess = () => {
                    request.result.close();
                    if (!blocked) {
                        if (!counts) reject(new Error("Local schema changed concurrently. Retry the migration."));
                        else resolve(counts);
                    }
                };
            });
        }
    } finally { database.close(); }
    if (result.repaired) await notifyWrites(storageId, [collection]);
    return result;
}
