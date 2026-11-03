import validateReadOptions from "../../../common/helpers/validateReadOptions";
import applyReadOptions from "../../../../../database/src/common/applyReadOptions";
import {fail} from "../../../../../common";
import {openLocalDatabase} from "../../../../../common/src/localDatabase";
import parsePath from "../../../../../database/src/local/parsePath";
import {runTransaction, readStore, readStoreKeys} from "./createHelpers";

export default async ({storageId, args}) => {
    if (![1, 2].includes(args.length)) fail("database/invalid-argument", "Expected (path, options?).");
    const [path, options = {}] = args;
    validateReadOptions(options);
    const {collection, effectivePath, keyField} = parsePath(path, "collection");
    if (!collection) fail("database/invalid-argument", "Expected a collection path.");
    const database = await openLocalDatabase(storageId);
    const value = await runTransaction(database, "readonly", [collection], transaction => {
        const store = transaction.objectStore(collection);
        if (options.shallow) {
            if (store.indexNames.length && Array.isArray(path)) return readStoreKeys(store, effectivePath, {keyField});
            return readStoreKeys(store, path);
        }
        // Unindexed stores are singleton documents, matching LocalDatabase.read.
        return store.indexNames.length && Array.isArray(path)
            ? readStore(store, effectivePath, {...options, keyField})
            : readStore(store, path, options);
    });
    if (options.shallow) return value;
    return Object.keys(options).length ? applyReadOptions(value, options) ?? null : value ?? null;
};
