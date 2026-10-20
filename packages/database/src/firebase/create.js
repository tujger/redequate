import {fail} from "../../../common";
import resolvePath from "../common/resolvePath";

export default function createRecord(firebase, path, options, run) {
    return run(() => {
        const effectivePath = resolvePath(path);

        const ref = firebase.database().ref(effectivePath).push();
        return {
            async save(value) {
                return run(() => saveRecord(ref, value), options, "create.save", {path, value});
            },
            temporaryKey: ref.key
        };
    }, options, "create", {path});
}

async function saveRecord(ref, value) {
    if (value === null || typeof value !== "object" || value instanceof Array) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    await ref.set(value);
    return ref.key;
}
