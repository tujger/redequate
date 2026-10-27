import {resolveCollectionPath} from "./helpers";

export default async function update(path, changes, options, run, superUpdate) {
    const batch = typeof path !== "string" && !Array.isArray(path);
    return run(() => {
        if (batch) {
            if (path === null || typeof path !== "object") return superUpdate(path);
            const entries = path instanceof Map ? [...path] : Object.entries(path);
            const updates = new Map(entries.map(([target, value]) => {
                resolveCollectionPath(target);
                return [target, value];
            }));
            return superUpdate(updates);
        }
        resolveCollectionPath(path);
        return superUpdate(path, changes);
    }, batch ? changes ?? options : options, "update", batch ? {updates: path} : {path, changes});
}
