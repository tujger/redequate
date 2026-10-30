import validateReadOptions from "../../../common/validateReadOptions";
import applyReadOptions from "../../../../../database/src/common/applyReadOptions";
import {fail} from "../../../../../common";
import {openLocalDatabase} from "../../../../../common/src/localDatabase";
import parsePath from "../../../../../database/src/local/parsePath";
import {runTransaction, readStore} from "./createHelpers";

export default async ({storageId, args}) => {
    if (![1, 2].includes(args.length)) fail("database/invalid-argument", "Expected (path, options?).");
    const [path, options = {}] = args;
    validateReadOptions(options);
    const {collection} = parsePath(path);
    if (!collection) fail("database/invalid-argument", "Expected a collection path.");
    const database = await openLocalDatabase(storageId);
    const value = await runTransaction(database, "readonly", [collection], transaction =>
        readStore(transaction.objectStore(collection), path, options));
    return Object.keys(options).length ? applyReadOptions(value, options) ?? null : value ?? null;
};
