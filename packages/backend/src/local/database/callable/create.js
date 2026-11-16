import {key as generateKey} from "firebase-key";
import {fail} from "../../../../../common";
import parsePath from "../../../../../database/src/local/parsePath";

import {addRecord, createRecordPath} from "./createHelpers";

export default async function createRecord({storageId, args}) {
    if (args.length !== 2) fail("database/invalid-argument", "Expected (path, value).");
    const [path, value] = args;
    if (value?.then instanceof Function) {
        Promise.resolve(value).catch(() => {});
        fail("database/invalid-argument", "value must be a record object.");
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    const {key: suppliedKey, address} = parsePath(path, "create");
    const key = suppliedKey ?? generateKey();
    console.debug("[Backend:Create]", `create [${address}]`, {value});
    await addRecord(storageId, createRecordPath(path, key), value);
    return key;
}
