import validatePath from "../common/validatePath";
import {fail} from "../../../common";

const STORE = "records";
const invalidPath = message => fail("database/invalid-argument", message);
export const TIMESTAMP = Symbol("LocalDatabase.TIMESTAMP");
const increments = new WeakMap();
export const increment = delta => {
    if (typeof delta !== "number" || !Number.isFinite(delta)) invalidPath("increment requires a finite number.");
    const marker = Object.freeze({});
    increments.set(marker, delta);
    return marker;
};

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const resolveValue = (value, previous, now) => {
    if (value === TIMESTAMP) return now;
    if (isRecord(value) && increments.has(value)) {
        return (typeof previous === "number" ? previous : 0) + increments.get(value);
    }
    if (Array.isArray(value)) return value.map((entry, index) => resolveValue(entry, previous?.[index], now));
    if (isRecord(value)) {
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            if (entry === undefined) invalidPath("Undefined values cannot be stored.");
            Object.defineProperty(result, key, {value: resolveValue(entry, previous?.[key], now),
                enumerable: true, writable: true, configurable: true});
        }
        return result;
    }
    return value;
};

const recordValue = (value, previous, now) => {
    const result = resolveValue(value, previous, now);
    if (!isRecord(result) || Object.hasOwn(result, "timestamp")) return result;
    if (previous === undefined) result.timestamp = now;
    else if (isRecord(previous) && Object.hasOwn(previous, "timestamp")) result.timestamp = previous.timestamp;
    return result;
};

// A path without a named segment addresses a collection. A trailing string after
// a named segment addresses a field for record operations, or a child collection
// when reading a subtree.
export const parseDatabasePath = (path, {allowField = true} = {}) => {
    validatePath(path);
    if (!Array.isArray(path) || !path.length || typeof path[0] !== "string" || !path[0]) {
        return invalidPath("Expected a collection path.");
    }
    const last = path.at(-1);
    const field = allowField && typeof last === "string" && path.length > 1
        && typeof path.at(-2) !== "string" ? last : undefined;
    const identity = field === undefined ? path.slice(1) : path.slice(1, -1);
    const keys = {};
    const values = {};
    const conditions = {};
    const segments = identity.map(segment => {
        if (typeof segment === "string") return ["literal", segment];
        const name = Object.getOwnPropertyNames(segment).find(key => key !== "_");
        const value = segment[name];
        if (Object.hasOwn(segment, "_")) {
            const level = segment._ === true ? 0 : segment._;
            if (!Number.isSafeInteger(level) || level < 0 || Object.hasOwn(keys, `_key${level}`)) {
                return invalidPath("Dynamic _ marker must be true or a unique non-negative integer level.");
            }
            keys[`_key${level}`] = name;
            values[`_value${level}`] = value;
            return ["dynamic", level, name, value];
        }
        if (Object.hasOwn(conditions, name) && conditions[name] !== value) {
            return invalidPath("Conflicting fixed path conditions.");
        }
        Object.defineProperty(conditions, name, {value, enumerable: true, configurable: true, writable: true});
        return ["fixed", name, value];
    });
    const levels = Object.keys(values).map(key => Number(key.slice(6)));
    const id = levels.length ? values[`_value${Math.max(...levels)}`] : undefined;
    const kind = field !== undefined ? "field" : identity.length && typeof last !== "string" ? "record" : "collection";
    return {collection: path[0], key: JSON.stringify(segments), keys, values, conditions, id, field, kind};
};

export const interpretPath = (path, options) => {
    const parsed = parseDatabasePath(path, options);
    if (parsed.kind === "collection") invalidPath("A record path must include a named identity segment.");
    return parsed;
};

const typeQuery = path => {
    if (!Array.isArray(path) || path.length !== 2 || typeof path[0] !== "string" || !path[0]) {
        return invalidPath("Expected [collection, type] or [collection, type conditions].");
    }
    const query = typeof path[1] === "string" ? {_key0: path[1]} : path[1];
    if (query === null || typeof query !== "object" || Array.isArray(query)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(query))
        || !Reflect.ownKeys(query).length) {
        return invalidPath("Type conditions must be a non-empty plain object.");
    }
    const keys = {};
    const conditions = {};
    for (const key of Reflect.ownKeys(query)) {
        if (typeof key !== "string" || typeof query[key] !== "string" || !query[key]) {
            return invalidPath("Type conditions need non-empty string values.");
        }
        if (/^_key(?:0|[1-9]\d*)$/.test(key)) keys[key] = query[key];
        else if (key.startsWith("_key")) return invalidPath("Invalid dynamic key level.");
        else Object.defineProperty(conditions, key, {value: query[key], enumerable: true, configurable: true, writable: true});
    }
    if (!Object.keys(keys).length) return invalidPath("At least one dynamic key is required.");
    return {collection: path[0], keys, conditions};
};

export const openDatabase = storageKey => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(`redequate:local:${storageKey}`);
    let blocked = false;
    request.onupgradeneeded = () => {
        const store = request.result.objectStoreNames.contains(STORE)
            ? request.transaction.objectStore(STORE)
            : request.result.createObjectStore(STORE, {keyPath: ["_collection", "_key"]});
        if (!store.indexNames.contains("_key0")) store.createIndex("_key0", ["_collection", "_key0"]);
        if (!store.indexNames.contains("_key1")) store.createIndex("_key1", ["_collection", "_key1"]);
        if (!store.indexNames.contains("_key0_key1")) store.createIndex("_key0_key1", ["_collection", "_key0", "_key1"]);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
        blocked = true;
        reject(new Error("Local database upgrade is blocked."));
    };
    request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        if (blocked) database.close();
        else resolve(database);
    };
});

const transact = async (storageKey, mode, run) => {
    const database = await openDatabase(storageKey);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE, mode);
            const store = transaction.objectStore(STORE);
            let result;
            let abortedError;
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(abortedError || transaction.error || new Error("LocalDatabase transaction aborted."));
            try {
                run(store, value => { result = value; }, error => {
                    abortedError = error;
                    transaction.abort();
                });
            } catch (error) {
                transaction.abort();
                reject(error);
            }
        });
    } finally {
        database.close();
    }
};

const keyFor = ({collection, key}) => [collection, key];
// _key is the record's primary-key component; _keyN names a dynamic segment.
const stored = (path, value) => ({_collection: path.collection, _key: path.key,
    ...path.keys, ...path.values, _conditions: path.conditions, id: path.id, value});

const operation = async (storageKey, rawPath, kind, value) => {
    const path = interpretPath(rawPath);
    if (kind === "add" || kind === "put") {
        if (value === undefined) invalidPath("Undefined values cannot be stored.");
    }
    return transact(storageKey, kind === "get" ? "readonly" : "readwrite", (store, setResult, abortWith) => {
        const key = keyFor(path);
        if (!path.field) {
            const request = kind === "get" ? store.get(key)
                : kind === "delete" ? store.delete(key) : store.get(key);
            if (kind === "get") request.onsuccess = () => setResult(request.result?.value);
            else if (kind === "add" || kind === "put") request.onsuccess = () => {
                if (kind === "add" && request.result) {
                    abortWith(new DOMException("Record already exists.", "ConstraintError"));
                    return;
                }
                const now = Date.now();
                try { store.put(stored(path, recordValue(value, request.result?.value, now))); }
                catch (error) { abortWith(error); }
            };
            return;
        }
        const request = store.get(key);
        request.onsuccess = () => {
            const row = request.result;
            if (kind === "get") {
                const data = row?.value;
                setResult(data !== null && typeof data === "object" && !Array.isArray(data)
                    ? data[path.field] : undefined);
                return;
            }
            if (!row && kind === "delete") return;
            if (!row && kind === "put") {
                try {
                    const now = Date.now();
                    store.put(stored(path, recordValue({[path.field]: resolveValue(value, undefined, now)},
                        undefined, now)));
                } catch (error) { abortWith(error); }
                return;
            }
            if (!row || row.value === null || typeof row.value !== "object" || Array.isArray(row.value)) {
                abortWith(new Error("A field write requires an existing object record."));
                return;
            }
            if (kind === "add" && Object.hasOwn(row.value, path.field)) {
                abortWith(new DOMException("Field already exists.", "ConstraintError"));
                return;
            }
            if (kind === "delete") delete row.value[path.field];
            else {
                try { row.value[path.field] = resolveValue(value, row.value[path.field], Date.now()); }
                catch (error) { abortWith(error); return; }
            }
            delete row._updatedAt;
            if (kind === "delete" && !Object.keys(row.value).length) store.delete(key);
            else store.put(row);
        };
    });
};

export const getRecord = async (storageKey, path) => {
    const parsed = parseDatabasePath(path);
    return parsed.kind === "record" ? operation(storageKey, path, "get") : getSubtree(storageKey, path);
};
export const addRecord = (storageKey, path, value) => operation(storageKey, path, "add", value);
export const putRecord = (storageKey, path, value) => operation(storageKey, path, "put", value);
export const deleteRecord = (storageKey, path) => operation(storageKey, path, "delete");

export const getSubtree = async (storageKey, rawPath) => {
    const path = parseDatabasePath(rawPath, {allowField: false});
    const prefix = JSON.parse(path.key);
    // A final string after a record can be both a value field and a child
    // collection. Assemble both at that path, as one Firebase snapshot would.
    const exactField = parseDatabasePath(rawPath).kind === "field"
        ? await operation(storageKey, rawPath, "get") : undefined;
    return transact(storageKey, "readonly", (store, setResult) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const rows = request.result.filter(row => row._collection === path.collection
                && JSON.parse(row._key).slice(0, prefix.length).every((segment, index) =>
                    JSON.stringify(segment) === JSON.stringify(prefix[index]))
                && JSON.parse(row._key).length >= prefix.length)
                .sort((a, b) => JSON.parse(a._key).length - JSON.parse(b._key).length);
            let result = exactField;
            for (const row of rows) {
                const segments = JSON.parse(row._key).slice(prefix.length);
                if (!segments.length) {
                    result = row.value;
                    continue;
                }
                if (!isRecord(result)) result = {};
                let target = result;
                for (const segment of segments.slice(0, -1)) {
                    const name = segment.at(-1);
                    if (!Object.hasOwn(target, name) || !isRecord(target[name])) {
                        Object.defineProperty(target, name, {
                            value: {}, enumerable: true, writable: true, configurable: true
                        });
                    }
                    target = target[name];
                }
                Object.defineProperty(target, segments.at(-1).at(-1), {
                    value: row.value, enumerable: true, writable: true, configurable: true
                });
            }
            setResult(result);
        };
    });
};

const resolveBatchPath = (rawPath, rows) => {
    if (Array.isArray(rawPath)) return parseDatabasePath(rawPath);
    if (typeof rawPath !== "string") invalidPath("Batch paths must be strings or DatabasePath arrays.");
    const parts = rawPath.split("/");
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !part)) {
        invalidPath("A batch string path must address a record or a top-level field.");
    }
    const [collection, id, field] = parts;
    const matches = rows.filter(row => row._collection === collection
        && JSON.parse(row._key).map(segment => segment.at(-1)).join("/") === id);
    if (matches.length > 1) invalidPath("Batch string path is ambiguous across named records.");
    if (matches.length) {
        const row = matches[0];
        return {...interpretPath([collection, {id, _: true}, ...(field ? [field] : [])]),
            key: row._key, keys: Object.fromEntries(Object.entries(row).filter(([key]) => /^_key\d+$/.test(key))),
            values: Object.fromEntries(Object.entries(row).filter(([key]) => /^_value\d+$/.test(key))),
            conditions: row._conditions, id: row.id};
    }
    return interpretPath([collection, {id, _: true}, ...(field ? [field] : [])]);
};

const startsWithSegments = (segments, prefix) => prefix.length <= segments.length
    && prefix.every((segment, index) => JSON.stringify(segment) === JSON.stringify(segments[index]));

const applyCollection = (rows, changed, rawPath, value, merge, now) => {
    if (value !== null && !isRecord(value)) invalidPath("A collection value must be a record object or null.");
    const collection = parseDatabasePath(rawPath, {allowField: false}).collection;
    const original = rows.filter(row => row._collection === collection);
    const rowSegments = row => JSON.parse(row._key);
    const current = () => {
        const result = new Map(original.map(row => [row._key, row]));
        for (const [identity, row] of changed) {
            const [name, key] = JSON.parse(identity);
            if (name !== collection) continue;
            if (row) result.set(key, row);
            else result.delete(key);
        }
        return [...result.values()];
    };
    const setRow = (row, next) => changed.set(JSON.stringify([collection, row._key]), next);
    const removeTree = prefix => {
        for (const row of current()) {
            if (startsWithSegments(rowSegments(row), prefix)) setRow(row, undefined);
        }
    };
    const replaceChildren = (prefix, entries) => {
        for (const [key, child] of entries) {
            if (!key || key.includes("/")) invalidPath("Collection child keys must be non-empty and cannot contain '/'.");
            const existing = original.filter(row => startsWithSegments(rowSegments(row), prefix)
                && rowSegments(row).length > prefix.length && rowSegments(row)[prefix.length].at(-1) === key);
            const tokens = [...new Set(existing.map(row => JSON.stringify(rowSegments(row)[prefix.length])))];
            if (tokens.length > 1) invalidPath("Collection child key is ambiguous across named records.");
            const path = (() => {
                const levels = prefix.filter(segment => segment[0] === "dynamic").map(segment => segment[1]);
                const marker = tokens.length ? JSON.parse(tokens[0]) : undefined;
                const childSegment = marker ? marker[0] === "literal" ? marker[1]
                    : marker[0] === "fixed" ? {[marker[1]]: marker[2]}
                        : {[marker[2]]: marker[3], _: marker[1]}
                    : collection === "posts" && !prefix.length ? {post_id: key}
                        : {id: key, _: levels.length ? Math.max(...levels) + 1 : 0};
                const parent = prefix.map(segment => segment[0] === "literal" ? segment[1]
                    : segment[0] === "fixed" ? {[segment[1]]: segment[2]}
                        : {[segment[2]]: segment[3], _: segment[1]});
                const parsed = parseDatabasePath([collection, ...parent, childSegment]);
                return parsed;
            })();
            const childPrefix = JSON.parse(path.key);
            const previous = existing.find(row => row._key === path.key);
            removeTree(childPrefix);
            if (child === null) continue;
            if (child === undefined) invalidPath("Undefined values cannot be stored.");
            let rowValue = child;
            if (isRecord(child)) {
                rowValue = {};
                for (const [name, entry] of Object.entries(child)) {
                    if (entry === undefined) invalidPath("Undefined values cannot be stored.");
                    if (entry === null) continue;
                    const nestedPrefix = [...childPrefix, ["literal", name]];
                    const hasChildren = original.some(row => startsWithSegments(rowSegments(row), nestedPrefix)
                        && rowSegments(row).length > nestedPrefix.length);
                    const looksLikeCollection = isRecord(entry) && Object.values(entry).some(isRecord)
                        && Object.values(entry).every(item => item === null || isRecord(item));
                    if (hasChildren || looksLikeCollection) {
                        replaceChildren(nestedPrefix, Object.entries(entry));
                    } else {
                        Object.defineProperty(rowValue, name, {value: entry, enumerable: true,
                            writable: true, configurable: true});
                    }
                }
            }
            const row = {...(previous ?? stored(path, rowValue)), value: recordValue(rowValue, previous?.value, now)};
            delete row._updatedAt;
            setRow(row, row);
        }
    };
    const prefix = JSON.parse(parseDatabasePath(rawPath, {allowField: false}).key);
    if (!merge) removeTree(prefix);
    if (value !== null) replaceChildren(prefix, Object.entries(value));
};

const applyBatch = (store, entries, merge, abortWith) => {
    const request = store.getAll();
    request.onsuccess = () => {
        try {
            const rows = request.result;
            const named = entries.filter(([rawPath]) => Array.isArray(rawPath))
                .map(([rawPath]) => parseDatabasePath(rawPath)).filter(path => path.kind !== "collection");
            const virtual = named.filter(path => !rows.some(row => row._collection === path.collection && row._key === path.key))
                .map(path => stored(path, {}));
            const prepared = entries.map(([rawPath, value]) => ({path: resolveBatchPath(rawPath, [...rows, ...virtual]), value}));
            for (let index = 0; index < prepared.length; index++) {
                const path = prepared[index].path;
                if (path.kind !== "collection") continue;
                const prefix = JSON.parse(path.key);
                if (prepared.some((other, otherIndex) => otherIndex !== index
                    && other.path.collection === path.collection
                    && (startsWithSegments(JSON.parse(other.path.key), prefix)
                        || other.path.kind === "collection" && startsWithSegments(prefix, JSON.parse(other.path.key))))) {
                    invalidPath("Conflicting batch paths.");
                }
            }
            const targets = new Set();
            for (const {path, value} of prepared) {
                if (value === undefined) invalidPath("Undefined values cannot be stored.");
                if (path.kind === "collection") continue;
                const identity = JSON.stringify([path.collection, path.key]);
                const target = JSON.stringify([identity, path.field ?? null]);
                if (targets.has(target) || (path.field && targets.has(JSON.stringify([identity, null])))) {
                    invalidPath("Conflicting batch paths.");
                }
                if (!path.field && [...targets].some(item => JSON.parse(item)[0] === identity)) {
                    invalidPath("Conflicting batch paths.");
                }
                targets.add(target);
            }
            const changed = new Map();
            const now = Date.now();
            for (const [index, {path, value}] of prepared.entries()) {
                if (path.kind === "collection") {
                    applyCollection(rows, changed, entries[index][0], value, merge, now);
                    continue;
                }
                const identity = JSON.stringify([path.collection, path.key]);
                const previous = changed.has(identity) ? changed.get(identity)
                    : rows.find(row => row._collection === path.collection && row._key === path.key);
                if (!path.field && !merge) {
                    changed.set(identity, value === null ? undefined
                        : stored(path, recordValue(value, previous?.value, now)));
                    continue;
                }
                const source = previous?.value;
                if (source !== undefined && !isRecord(source)) invalidPath("A field update requires an object record.");
                if (merge && !isRecord(value)) invalidPath("changes must be a record object.");
                const changes = merge ? Object.entries(value) : [[path.field, value]];
                const next = {...source};
                for (const [name, entry] of changes) {
                    if (entry === undefined) invalidPath("Undefined values cannot be stored.");
                    if (entry === null) delete next[name];
                    else next[name] = resolveValue(entry, next[name], now);
                }
                if (previous || Object.keys(next).length) {
                    const row = {...(previous ?? stored(path, next)), value: recordValue(next, previous?.value, now)};
                    delete row._updatedAt;
                    changed.set(identity, row);
                }
            }
            for (const [identity, row] of changed) {
                const [collection, key] = JSON.parse(identity);
                if (row) store.put(row);
                else store.delete([collection, key]);
            }
        } catch (error) { abortWith(error); }
    };
};

export const updateRecords = (storageKey, entries, {merge = false} = {}) =>
    transact(storageKey, "readwrite", (store, setResult, abortWith) => applyBatch(store, entries, merge, abortWith));

export const getAllRecords = storageKey => transact(storageKey, "readonly", (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
});

// Returns {id, value} entries. Dynamic segment names are indexed by their explicit level;
// fixed named segments filter by their field names, independent of path position.
export const getRecordsByType = async (storageKey, path) => {
    const {collection, keys, conditions} = typeQuery(path);
    return transact(storageKey, "readonly", (store, setResult) => {
        const index = Object.hasOwn(keys, "_key0") && Object.hasOwn(keys, "_key1")
            ? "_key0_key1" : Object.hasOwn(keys, "_key0") ? "_key0"
                : Object.hasOwn(keys, "_key1") ? "_key1" : undefined;
        const key = index === "_key0_key1" ? [collection, keys._key0, keys._key1]
            : index ? [collection, keys[index]] : undefined;
        const request = index ? store.index(index).getAll(key) : store.getAll();
        request.onsuccess = () => setResult(request.result
            .filter(row => row._collection === collection
                && Object.entries(keys).every(([name, value]) => row[name] === value)
                && Object.entries(conditions).every(([name, value]) => row._conditions[name] === value))
            .map(({id, value}) => ({id, value})));
    });
};
