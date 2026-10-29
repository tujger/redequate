import {key as generateKey} from "firebase-key";
import {fail} from "../../../../../common";
import parsePath from "../../../../../database/src/common/parsePath";
import resolvePath from "../../../../../database/src/common/resolvePath";
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
    const parsed = parsePath(path);
    if (parsed.literal || parsed.path.length < 2) fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
    const last = parsed.path.at(-1);
    const fieldName = typeof last === "string" ? last : parsed.segments.at(-1).name;
    const suppliedKey = typeof last === "string" ? undefined : last[fieldName];
    const key = suppliedKey ?? generateKey();
    console.debug("[Backend:Create]", `create [${resolvePath(path)}]`, {value});
    await addRecord(storageId, createRecordPath(path, key), value);
    return key;
}
