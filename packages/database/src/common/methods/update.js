import {fail} from "../../../../common";
import applyUpdate from "../applyUpdate";

const invalid = message => fail("database/invalid-argument", message);
const isObject = value => value !== null && typeof value === "object";
const set = (object, name, value) => Object.defineProperty(object, name,
    {value, enumerable: true, writable: true, configurable: true});

const prepareChanges = changes => {
    if (changes?.then instanceof Function) {
        Promise.resolve(changes).catch(() => {});
        invalid("changes must be an object.");
    }
    if (!isObject(changes) || Array.isArray(changes)) invalid("changes must be an object.");
    const entries = Object.entries(changes).map(([key, value]) => {
        const names = key.split("/");
        if (names.some(name => !name)) invalid("Update paths must not contain empty segments.");
        return [names, value];
    });
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i][0], b = entries[j][0];
        if (a.slice(0, Math.min(a.length, b.length)).every((name, index) => name === b[index])) {
            invalid("Update paths must not overlap.");
        }
    }
    return entries;
};

const merge = (previous, entries) => {
    const value = isObject(previous) ? structuredClone(previous) : {};
    for (const [names, child] of entries) {
        let node = value;
        for (const name of names.slice(0, -1)) {
            if (!Object.hasOwn(node, name) || !isObject(node[name])) {
                if (child === null) { node = undefined; break; }
                set(node, name, {});
            }
            node = node[name];
        }
        if (node === undefined) continue;
        if (child === null) delete node[names.at(-1)];
        else set(node, names.at(-1), child);
    }
    return value;
};

export default async function update(backend, path, changes) {
    const callback = changes instanceof Function;
    const entries = callback ? undefined : prepareChanges(changes);
    let snapshot = await backend.request("database.update", path, null, {mode: "read"});
    for (let attempt = 0; attempt < 25; attempt++) {
        const value = callback ? applyUpdate(changes, snapshot.value) ?? null : merge(snapshot.value, entries);
        snapshot = await backend.request("database.update", path, value, {mode: "replace", etag: snapshot.etag});
        if (snapshot.committed) return callback ? snapshot.value : undefined;
        if (attempt < 24) {
            const maximum = Math.min(1000, 25 * 2 ** attempt);
            await new Promise(resolve => setTimeout(resolve, Math.random() * maximum));
        }
    }
    fail("database/conflict", "Update was not committed after 25 attempts.");
}
