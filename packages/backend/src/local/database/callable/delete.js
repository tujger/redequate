import parsePath from "../../../../../database/src/local/parsePath";

import {fail} from "../../../../../common";
import {openLocalDatabase} from "../../../../../common/src/localDatabase";
import {runTransaction, writeStore, notifyWrites} from "./createHelpers";

export default async function deleteRecord({storageId, args}) {
    if (args.length !== 1) fail("database/invalid-argument", "Expected (path).");
    const [path] = args;
    const {collection, address} = parsePath(path);
    if (!collection) fail("database/invalid-argument", "Expected a collection path.");
    const database = await openLocalDatabase(storageId);
    console.debug("[Backend:Delete]", `delete [${address}]`);
    await runTransaction(database, "readwrite", [collection], transaction =>
        writeStore(transaction.objectStore(collection), path, null));
    await notifyWrites(storageId, [collection]);
    return null;
}
