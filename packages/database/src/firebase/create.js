import {resolvePath} from "./common";
import {fail} from "../../../common/src/_packages";

export default function createRecord(firebase, path) {
    const effectivePath = resolvePath(path);

    const ref = firebase.database().ref(effectivePath).push();
    const save = async value => {
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
    };
    Object.defineProperty(save, "temporaryKey", {value: ref.key, enumerable: true});
    return save;
}
