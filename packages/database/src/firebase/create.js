import {fail} from "../../../common";
import resolvePath from "../common/resolvePath";
import parseCreatePath from "../common/parseCreatePath";

export default function createRecord(firebase, path, options, run) {
    return run(() => {
        const {parentPath, key} = parseCreatePath(path);
        const effectivePath = resolvePath(parentPath);
        const ref = key === undefined ? firebase.database().ref(effectivePath).push()
            : firebase.database().ref(`${effectivePath}/${key}`);
        return {
            async save(value) {
                return run(() => saveRecord(ref, value), options, "create.save", {path, value});
            },
            temporaryKey: ref.key
        };
    }, options, "create", {path});
}

async function saveRecord(ref, value) {
    if (value instanceof Function) value = value(ref.key);
    if (value?.then instanceof Function) {
        Promise.resolve(value).catch(() => {});
        fail("database/invalid-argument", "create callback must be synchronous.");
    }
    if (value === null || typeof value !== "object" || value instanceof Array) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    let conflict = false;
    const result = await ref.transaction(current => {
        if (current !== null && current !== undefined) {
            conflict = true;
            return undefined;
        }
        return value;
    }, undefined, false);
    if (!result.committed) {
        if (conflict) fail("database/conflict", "Record already exists.");
        fail("database/conflict", "Record creation was not committed.");
    }
    return ref.key;
}
