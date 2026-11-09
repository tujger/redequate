import {key as generateKey} from "firebase-key";
import {fail, notImplemented} from "../../../../common";
import parsePath from "../parsePath";

export default async function createRecord(backend, path, value, implementation) {
    if (!implementation) return notImplemented("create");
    const {key, mapError} = implementation;
    const parsed = parsePath(path);
    if (parsed.literal || parsed.path.length < 2) fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
    const last = parsed.path.at(-1);
    const suppliedKey = typeof last === "string" ? undefined : last[parsed.segments.at(-1).name];
    const recordKey = suppliedKey ?? key;
    const keys = [];
    const preparedPath = parsed.path.map((segment, index) => {
        if (!index || typeof segment !== "string") return segment;
        const generatedKey = index === parsed.path.length - 1 ? recordKey : generateKey();
        // Firebase can allocate the final key on the backend for an ordinary value.
        if (generatedKey === undefined) return segment;
        keys.push(generatedKey);
        return {[segment]: generatedKey};
    });
    const preparedValue = value instanceof Function
        ? value(...(keys.length ? keys : [recordKey]))
        : value;
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
