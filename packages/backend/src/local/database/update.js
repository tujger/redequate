import {isIncrement} from "../increment";
import {fail} from "../../../../common";
import {openLocalDatabase} from "../../../../common/src/localDatabase";
import validatePath from "../../../../database/src/common/validatePath";
import {
    TIMESTAMP, validateCollectionPath, runTransaction, readStore, writeStore,
    childRecordPath, assertNonOverlapping, notifyWrites
} from "./createHelpers";

const invalid = message => fail("database/invalid-argument", message);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isRoot = path => typeof path === "string" ? !path.split("/").filter(Boolean).length
    : Array.isArray(path) && !path.length;

const validateValue = (value, ancestors = new Set()) => {
    if (value === TIMESTAMP || value === null || typeof value === "string" || typeof value === "boolean" ||
        typeof value === "number" && Number.isFinite(value)) return;
    if (value?.then instanceof Function) {
        Promise.resolve(value).catch(() => {});
        invalid("Update values must be prepared synchronously.");
    }
    if (!Array.isArray(value) && !isRecord(value)) invalid("Invalid update value.");
    if (ancestors.has(value)) invalid("Update values must not contain cycles.");
    ancestors.add(value);
    for (const child of Object.values(value)) validateValue(child, ancestors);
    ancestors.delete(value);
};

const prepare = args => {
    if (![2, 3].includes(args.length)) invalid("Expected (path, changes, options?).");
    const [path, value, options = {}] = args;
    validatePath(path);
    if (!isRecord(options)) invalid("Invalid update options.");
    const mode = options.mode ?? (isIncrement(value) ? "increment" : "patch");
    if (!["patch", "read", "replace", "increment"].includes(mode)) invalid("Invalid update mode.");
    if (mode === "increment" && !isIncrement(value)) invalid("Expected an increment value.");
    const root = isRoot(path);
    if (root && mode !== "patch") invalid("Only batch patch accepts an empty path.");
    if (!root) validateCollectionPath(path);
    if (!(root && mode === "patch" && value instanceof Map)) validateValue(value);
    if (mode === "read" && value !== null) invalid("Read requires a null value.");
    if (mode === "replace" && (typeof options.etag !== "string" || !options.etag.length || /[\r\n]/.test(options.etag))) {
        invalid("Conditional replacement requires an ETag.");
    }
    if (mode !== "patch") {
        return {path, value, mode, etag: options.etag, names: [validateCollectionPath(path)[0]]};
    }
    if (!isRecord(value) && !(root && value instanceof Map)) invalid("changes must be an object, or a Map for a root batch.");
    const entries = value instanceof Map ? [...value] : Object.entries(value);
    for (const [entryPath, child] of entries) {
        if (value instanceof Map) validateValue(child);
        if (root) {
            validatePath(entryPath);
            validateCollectionPath(entryPath);
        }
        else if (!entryPath.split("/").filter(Boolean).length) invalid("Patch paths must not be empty.");
    }
    const names = root ? [...new Set(entries.map(([path]) => validateCollectionPath(path)[0]))]
        : [validateCollectionPath(path)[0]];
    return {path, root, entries, mode, names};
};

// An exact, deterministic token avoids hash collisions and persistent revision fields.
const snapshotETag = value => {
    const encode = value => Array.isArray(value) ? ["array", value.map(encode)]
        : value !== null && typeof value === "object"
            ? ["object", Object.keys(value).sort().map(name => [name, encode(value[name])])]
            : [typeof value, typeof value === "number" ? Object.is(value, -0) ? "-0" : String(value) : value];
    return JSON.stringify(encode(value));
};

export default async function update({storageId, args}) {
    const prepared = prepare(args);
    const {path, value, mode, names, entries, root, etag} = prepared;
    if (!names.length) return null;
    const database = await openLocalDatabase(storageId);
    let committed = false;
    const result = await runTransaction(database, mode === "read" ? "readonly" : "readwrite", names, async transaction => {
        if (mode === "patch") {
            const updates = entries.map(([relative, value]) => {
                if (root) return [relative, value];
                const store = transaction.objectStore(names[0]);
                const target = relative.split("/").filter(Boolean)
                    .reduce((target, key) => childRecordPath(store, target, key), path);
                return [target, value];
            });
            assertNonOverlapping(transaction, updates);
            const now = Date.now();
            for (const [target, changes] of updates) {
                const name = validateCollectionPath(target)[0];
                await writeStore(transaction.objectStore(name), target, changes, {now});
            }
            committed = updates.length > 0;
            return null;
        }
        const store = transaction.objectStore(names[0]);
        if (mode === "increment") {
            await writeStore(store, path, value);
            committed = true;
            return await readStore(store, path) ?? null;
        }
        const current = await readStore(store, path) ?? null;
        const currentETag = snapshotETag(current);
        if (mode === "read") return {value: current, etag: currentETag};
        if (etag !== currentETag) return {committed: false, value: current, etag: currentETag};
        await writeStore(store, path, value);
        const saved = await readStore(store, path) ?? null;
        committed = true;
        return {committed: true, value: saved};
    });
    if (committed) await notifyWrites(storageId, names);
    return result;
}
