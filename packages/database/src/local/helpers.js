import parsePath from "./parsePath";
import {fail} from "../../../common";
import {LOCAL_SCHEMA} from "./storeSchema";
import {applySchema} from "./schema";
import {openDatabase as openConnection} from "./connection";
import {
    validateCollectionPath, runTransaction, readStore, childRecordPath
} from "../../../backend/src/local/database/callable/createHelpers";

const invalid = message => fail("database/invalid-argument", message);
const storeNames = context => Object.keys(context?.schema ?? LOCAL_SCHEMA);

export const openDatabase = async (context, initialSchema = LOCAL_SCHEMA) => {
    if (typeof context === "string") return openConnection(context, initialSchema);
    if (!context.ready) {
        context.ready = applySchema(context.storageId, context.schema, context.schema)
            .catch(error => { context.ready = undefined; throw error; });
    }
    await context.ready;
    return openConnection(context.storageId, context.schema);
};

export const assertCollection = (context, collection) => {
    if (!Object.hasOwn(context?.schema ?? LOCAL_SCHEMA, collection)) invalid(`Unknown Local collection: ${collection}`);
};

const transact = async (context, mode, names, operation) => {
    for (const name of names) assertCollection(context, name);
    const database = await openDatabase(context);
    return runTransaction(database, mode, names, operation);
};

const read = (context, rawPath, options, query) => {
    const parsed = parsePath(rawPath, query ? "collection" : "address");
    const root = !parsed.path.length;
    const names = root ? storeNames(context) : [parsed.collection];
    return transact(context, "readonly", names, async transaction => {
        if (root) {
            const entries = await Promise.all(names.map(async name => [name,
                await readStore(transaction.objectStore(name), [name], options)]));
            return Object.fromEntries(entries);
        }
        const store = transaction.objectStore(names[0]);
        if (query && store.indexNames.length && Array.isArray(rawPath)) {
            const {effectivePath: path, keyField} = parsed;
            return readStore(store, path, {...options, keyField});
        }
        return readStore(store, rawPath, options);
    });
};

export const readValue = (context, path, options = {}) => read(context, path, options, true);
export const getSubtree = (context, path, options = {}) => read(context, path, options, false);
export const getCursorChildren = (context, path, keyField, options = {}) =>
    read(context, path, {...options, keyField}, false);

export const getChildRecordPath = (context, path, key, keyField) => {
    const {collection: name} = parsePath(path);
    return transact(context, "readonly", [name], transaction => childRecordPath(transaction.objectStore(name), path, key, keyField));
};

export {validateCollectionPath} from "../../../backend/src/local/database/callable/createHelpers";
