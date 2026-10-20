import {fail} from "../../../common";
import resolvePath from "./resolvePath";

export default async function write(firebase, path, value) {
    if (value === undefined) {
        fail("database/invalid-argument", "value must not be undefined.");
    }
    const effectivePath = resolvePath(path);

    const ref = firebase.database().ref(effectivePath);
    await ref.set(value);
}
