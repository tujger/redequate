import {resolvePath} from "./common";

export default async function update(path, changes, {} = {}) {
    const updates = {};
    if(path instanceof Map) {
        for (const [p, value] of path) {
            updates[resolvePath(p)] = value;
        }
    } else if(changes === undefined) {
        for (const p in path) {
            updates[resolvePath(p)] = path[p];
        }
    } else {
        updates[resolvePath(path)] = changes;
    }
    return this.#firebase.database().ref().update(updates);
}
