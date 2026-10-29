import parsePath from "./parsePath";

export default async function update(path, changes, options, run, superUpdate) {
    const batch = typeof path !== "string" && !Array.isArray(path);
    return run(() => {
        if (batch) {
            if (path === null || typeof path !== "object") return superUpdate(path);
            const entries = path instanceof Map ? [...path] : Object.entries(path);
            const updates = Object.fromEntries(entries.map(([target, value]) => [parsePath(target).address, value]));
            return superUpdate(updates);
        }
        return superUpdate(parsePath(path).address, changes);
    }, batch ? changes ?? options : options, "update", batch ? {updates: path} : {path, changes});
}
