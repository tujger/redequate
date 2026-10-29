import {fail, notImplemented} from "../../../../common";
import parsePath from "../parsePath";

export default async function createRecord(backend, path, value, implementation) {
    if (!implementation) return notImplemented("create");
    const {key, mapError} = implementation;
    const parsed = parsePath(path);
    if (parsed.literal || parsed.path.length < 2) fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
    const parentPath = parsed.path.slice(0, -1);
    const last = parsed.path.at(-1);
    const fieldName = typeof last === "string" ? last : parsed.segments.at(-1).name;
    const suppliedKey = typeof last === "string" ? undefined : last[fieldName];
    const recordKey = suppliedKey ?? key;
    const preparedValue = value instanceof Function ? value(recordKey) : value;
    if (preparedValue?.then instanceof Function) {
        Promise.resolve(preparedValue).catch(() => {});
        fail("database/invalid-argument", "create callback must be synchronous.");
    }
    if (preparedValue === null || typeof preparedValue !== "object" || Array.isArray(preparedValue)) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    const preparedPath = recordKey === undefined ? path : [...parentPath, {[fieldName]: recordKey}];
    try {
        return await backend.request("database.create", preparedPath, preparedValue);
    } catch (error) {
        throw mapError ? mapError(error) : error;
    }
}
