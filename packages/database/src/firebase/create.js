import {fail} from "../../../common";
import {resolvePath} from "./common";

export default function createRecord(firebase, path, options, run) {
    return run(() => {
        const effectivePath = resolvePath(path);

        const ref = firebase.database().ref(effectivePath).push();
        return {
            async save(value) {
                return run(async () => {
                    if (value === null || typeof value !== "object" || value instanceof Array) {
                        fail("database/invalid-argument", "value must be a record object.");
                    }
                    const result = await ref.transaction(current => {
                        return current === null ? value : undefined;
                    }, undefined, false);
                    if (!result.committed) {
                        fail("database/already-exists", "A record already exists at the generated key.");
                    }
                    return ref.key;
                }, options, "create.save", {path, value});
            },
            temporaryKey: ref.key
        };
    }, options, "create", {path});
}
