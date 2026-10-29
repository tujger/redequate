import {fail} from "../../../../../common";
import {openLocalDatabase} from "../../../../../common/src/localDatabase";
import parsePath from "../../../../../database/src/local/parsePath";
import {runTransaction, readStore} from "./createHelpers";

export default async ({storageId, args}) => {
    if (args.length !== 1) fail("database/invalid-argument", "Expected (path).");
    const [path] = args;
    const {collection} = parsePath(path);
    if (!collection) fail("database/invalid-argument", "Expected a collection path.");
    const database = await openLocalDatabase(storageId);
    return await runTransaction(database, "readonly", [collection], transaction =>
        readStore(transaction.objectStore(collection), path)) ?? null;
};
