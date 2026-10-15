import {fail} from "../../../common";
import {resolvePath} from "./common";

export default async function update(firebase, path, changes, {} = {}) {
    if ((typeof path === "string" || Array.isArray(path)) && changes === undefined) {
        fail("database/invalid-argument", "changes must be provided when path is a string or array.");
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
