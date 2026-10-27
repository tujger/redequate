import validatePath from "../../../../database/src/common/validatePath";
import {fail} from "../../../../common";
import {openLocalDatabase} from "../../../../common/src/localDatabase";
import {validateCollectionPath, runTransaction, writeStore, notifyWrites} from "./createHelpers";

export default async function deleteRecord({storageId, args}) {
    if (args.length !== 1) fail("database/invalid-argument", "Expected (path).");
    const [path] = args;
    validatePath(path);
    const collection = validateCollectionPath(path)[0];
    const database = await openLocalDatabase(storageId);
    await runTransaction(database, "readwrite", [collection], transaction =>
        writeStore(transaction.objectStore(collection), path, null));
    await notifyWrites(storageId, [collection]);
    return null;
}
