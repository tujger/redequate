import {fail} from "../../../../common";
import parseCreatePath from "../parseCreatePath";

export default async function createRecord(backend, path, value, {key, mapError}) {
    const {parentPath, fieldName, key: suppliedKey} = parseCreatePath(path);
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
