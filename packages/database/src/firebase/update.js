import {fail} from "../../../common";
import applyUpdate from "../common/applyUpdate";
import resolvePath from "../common/resolvePath";

export default async function update(firebase, path, changes, {} = {}) {
    if ((typeof path === "string" || path instanceof Array) && changes === undefined) {
        fail("database/invalid-argument", "changes must be provided when path is a string or array.");
    }
    if (changes instanceof Function) {
        const ref = firebase.database().ref(resolvePath(path));
        const result = await ref.transaction(value => applyUpdate(changes, value), undefined, false);
        return result.committed ? result.snapshot.val() : (await ref.once("value")).val();
    }
    const updates = {};
    if (path instanceof Map) {
        for (const [p, value] of path) {
            updates[resolvePath(p)] = value;
        }
    } else if (changes === undefined) {
        for (const p in path) {
            updates[resolvePath(p)] = path[p];
        }
    } else {
        return firebase.database().ref(resolvePath(path)).update(changes);
    }
    return firebase.database().ref().update(updates);
}
