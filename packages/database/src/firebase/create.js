import {resolvePath} from "./common";
import {fail} from "../../../common/src/_packages";

export default function createRecord(firebase, path) {
    const effectivePath = resolvePath(path);

    const ref = firebase.database().ref(effectivePath).push();
    return {
        async save(value) {
            if (value === null || typeof value !== "object" || Array.isArray(value)) {
                fail("database/invalid-argument", "value must be a record object.");
            }
            const result = await ref.transaction(current => {
                return current === null ? value : undefined;
            }, undefined, false);
            if (!result.committed) {
                fail("database/already-exists", "A record already exists at the generated key.");
            }
            return ref.key;
        },
        temporaryKey: ref.key
    }
}
