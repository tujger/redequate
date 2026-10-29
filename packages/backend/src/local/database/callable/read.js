import {fail} from "../../../../../common";
import {openLocalDatabase} from "../../../../../common/src/localDatabase";
import validatePath from "../../../../../database/src/common/validatePath";
import {validateCollectionPath, runTransaction, readStore} from "./createHelpers";

export default async ({storageId, args}) => {
    if (args.length !== 1) fail("database/invalid-argument", "Expected (path).");
    const [path] = args;
    validatePath(path);
    const collection = validateCollectionPath(path)[0];
    const database = await openLocalDatabase(storageId);
    return await runTransaction(database, "readonly", [collection], transaction =>
        readStore(transaction.objectStore(collection), path)) ?? null;
};
