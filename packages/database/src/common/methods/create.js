import {key as generateKey} from "firebase-key";
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
    let preparedPath = recordKey === undefined ? path : [...parentPath, {[fieldName]: recordKey}];
    let preparedValue = value;
    if (value instanceof Function) {
        const keys = [];
        preparedPath = parsed.path.map((segment, index) => {
            if (!index || typeof segment !== "string") return segment;
            const generatedKey = index === parsed.path.length - 1 ? recordKey : generateKey();
            keys.push(generatedKey);
            return {[segment]: generatedKey};
        });
        preparedValue = value(...(keys.length ? keys : [recordKey]));
    }
    if (preparedValue?.then instanceof Function) {
        Promise.resolve(preparedValue).catch(() => {});
        fail("database/invalid-argument", "create callback must be synchronous.");
    }
    if (preparedValue === null || typeof preparedValue !== "object" || Array.isArray(preparedValue)) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    try {
        return await backend.request("database.create", preparedPath, preparedValue);
    } catch (error) {
        throw mapError ? mapError(error) : error;
    }
}
