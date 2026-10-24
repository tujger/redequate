import {getDatabase, ref, runTransaction, update as updateFields} from "firebase/database";
import readSnapshot from "./readSnapshot";
import {fail} from "../../../common";
import applyUpdate from "../common/applyUpdate";
import resolvePath from "../common/resolvePath";

export default async function update(firebase, path, changes) {
    if ((typeof path === "string" || path instanceof Array) && changes === undefined) {
        fail("database/invalid-argument", "changes must be provided when path is a string or array.");
    }
    if (changes instanceof Function) {
        const reference = ref(getDatabase(firebase.app), resolvePath(path));
        const result = await runTransaction(reference, value => {
            const next = applyUpdate(changes, value);
            return next == null ? null : next;
        }, {applyLocally: false});
        return result.committed ? result.snapshot.val() : (await readSnapshot(reference)).val();
    }
    const updates = {};
    if (path instanceof Map) {
        for (const [p, value] of path) {
            if (value instanceof Function) fail("database/invalid-argument", "Batch updates do not accept callbacks.");
            updates[resolvePath(p)] = value;
        }
    } else if (changes === undefined) {
        for (const p in path) {
            if (path[p] instanceof Function) fail("database/invalid-argument", "Batch updates do not accept callbacks.");
            updates[resolvePath(p)] = path[p];
        }
    } else {
        return updateFields(ref(getDatabase(firebase.app), resolvePath(path)), changes);
    }
    return updateFields(ref(getDatabase(firebase.app)), updates);
}
