import parseReadPath from "../common/parseReadPath";
import applyUpdate from "../common/applyUpdate";
import parseCreatePath from "../common/parseCreatePath";
import resolvePath from "../common/resolvePath";
import validatePath from "../common/validatePath";
import {fail} from "../../../common";
import {LOCAL_SCHEMA} from "./storeSchema";
import {decodeRow, encodeRow} from "./row";
import {applySchema} from "./schema";
import {openDatabase as openConnection} from "./connection";
import {identityField as identityFieldName, identityTokens} from "./identity";

const storeName = collection => {
    if (typeof collection !== "string" || !collection || collection.includes("/")) fail("database/invalid-argument", "Invalid Local collection.");
    return collection;
};
const storeNames = context => Object.keys(context?.schema ?? LOCAL_SCHEMA);
const numericKey = key => typeof key === "string" && /^[1-9]\d*$/.test(key) && Number.isSafeInteger(Number(key))
    ? Number(key)
    : undefined;
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
            Object.defineProperty(result, key, {
                value: resolveValue(entry, previous?.[key], now),
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
        return result;
    }
    return value;
};

const recordValue = resolveValue;

export const resolveCollectionPath = path => {
    validatePath(path);
    if (!Array.isArray(path) || !path.length) invalidPath("Expected a collection path.");
    let collection = path[0];
    if (typeof collection !== "string") {
        const name = Object.getOwnPropertyNames(collection).find(key => key !== "_");
        storeName(collection[name]);
        collection = resolvePath(path.slice(0, 1));
    }
    const result = [collection, ...path.slice(1)];
    const last = result.at(-1);
    if (result.length > 2 && typeof last !== "string" && !Object.hasOwn(last, "_") &&
        typeof result.at(-2) !== "string") {
        const name = Object.getOwnPropertyNames(last)[0];
        if (last[name] === name) result[result.length - 1] = name;
    }
    return result;
};

// A path without a named segment addresses a collection. A trailing string after
// a named segment addresses a field for record operations, or a child collection
// when reading a subtree.
export const parseDatabasePath = (path, {allowField = true} = {}) => {
    path = resolveCollectionPath(path);
    const last = path.at(-1);
    const field = allowField && typeof last === "string" && path.length > 1 &&
        typeof path.at(-2) !== "string"
        ? last
        : undefined;
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
        if (["_collection", "_key", "_id", "value"].includes(name) || /^_(?:key|value)\d+$/.test(name)) {
            invalidPath("A fixed condition cannot overwrite a Local storage field.");
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
    return {collection: path[0], key: JSON.stringify(segments), segments, keys, values, conditions, id, field, kind};
};

export const interpretPath = (path, options) => {
    const parsed = parseDatabasePath(path, options);
    if (parsed.kind === "collection") invalidPath("A record path must include a named identity segment.");
    return parsed;
};

const typeQuery = path => {
    if (!Array.isArray(path) || path.length !== 2) {
        return invalidPath("Expected [collection, type] or [collection, type conditions].");
    }
    const [collection] = resolveCollectionPath([path[0]]);
    const query = typeof path[1] === "string" ? {_key0: path[1]} : path[1];
    if (query === null || typeof query !== "object" || Array.isArray(query) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(query)) ||
        !Reflect.ownKeys(query).length) {
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
    return {collection, keys, conditions};
};

// Contexts belong to instances. No global registry can expand another instance's collections.
export const openDatabase = async (storageKey, initialSchema = LOCAL_SCHEMA) => {
    if (typeof storageKey === "string") return openConnection(storageKey, initialSchema);
    const context = storageKey;
    if (!context.ready) {
        context.ready = applySchema(context.storageKey, context.schema, context.schema)
            .catch(error => { context.ready = undefined; throw error; });
    }
    await context.ready;
    return openConnection(context.storageKey, context.schema);
};

export const assertCollection = (context, collection) => {
    if (!Object.hasOwn(context?.schema ?? LOCAL_SCHEMA, collection)) {
        invalidPath(`Unknown Local collection: ${collection}`);
    }
};

const transact = async (storageKey, mode, names, run) => {
    for (const name of names ?? []) assertCollection(storageKey, name);
    const database = await openDatabase(storageKey);
    try {
        return await new Promise((resolve, reject) => {
            const selected = names ?? storeNames(storageKey).filter(name => database.objectStoreNames.contains(name));
            const transaction = database.transaction([...new Set(selected)], mode);
            let result;
            let abortedError;
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(abortedError || transaction.error || new Error("LocalDatabase transaction aborted."));
            try {
                run(transaction, value => { result = value; }, error => {
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

const storedSegments = row => {
    const segments = identityTokens(row._key).map(token => token[0] === "fixed"
        ? [token[0], token[1], Object.hasOwn(row, token[1]) ? row[token[1]] : token[2]]
        : token[0] === "dynamic" ? [token[0], token[1], token[2], row[`_value${token[1]}`] ?? token[3]] : token);
    const last = segments.at(-1);
    if (segments.length > 1 && last[0] === "fixed" && last[1] === last[2] &&
        segments.at(-2)[0] !== "literal") segments[segments.length - 1] = ["literal", last[1]];
    return segments;
};

const readStores = (transaction, receive) => {
    const rows = [];
    const names = [...transaction.objectStoreNames];
    let pending = names.length;
    for (const name of names) {
        const request = transaction.objectStore(name).getAll();
        request.onsuccess = () => {
            rows.push(...request.result.map(row => decodeRow(row, name)).filter(row => row?._collection === name));
            if (!--pending) receive(rows);
        };
    }
};

const generatedSegment = (key, prefix) => {
    const levels = prefix.filter(segment => segment[0] === "dynamic").map(segment => segment[1]);
    return {id: key, _: levels.length ? Math.max(...levels) + 1 : 0};
};

export const createRecordPath = (rawPath, key) => {
    const {parentPath, fieldName} = parseCreatePath(rawPath);
    const parent = resolveCollectionPath(parentPath);
    const dynamicLevels = parseDatabasePath(parent, {allowField: false}).segments
        .filter(segment => segment[0] === "dynamic").map(segment => segment[1]);
    const identity = fieldName === "id" && dynamicLevels.length
        ? {id: key, _: Math.max(...dynamicLevels) + 1}
        : {[fieldName]: key};
    const path = [...parent, identity];
    interpretPath(path);
    return path;
};

const keyFor = ({collection, key}) => [collection, key];
const pathSegments = path => path.segments ?? JSON.parse(path.key);
const reservedField = name => ["_collection", "_key", "_id", "value", "id"].includes(name) ||
    /^_(?:key|value)\d+$/.test(name);
const stored = (path, value) => ({
    ...Object.fromEntries(isRecord(value)
        ? Object.keys(value).filter(name => !reservedField(name))
            .map(name => [name, name])
        : []),
    ...path.conditions,
    ...path.keys,
    ...path.values,
    ...(path.id !== undefined ? {id: path.id} : {}),
    _collection: path.collection,
    _key: path.key,
    value
});

const relativeSegments = (row, prefix) => {
    const segments = storedSegments(row);
    const selected = new Set();
    for (const token of prefix.filter(segment => segment[0] === "fixed")) {
        if (!Object.hasOwn(row, token[1]) || row[token[1]] !== token[2]) return;
        const index = segments.findIndex(segment => segment[0] === "fixed" &&
            segment[1] === token[1]);
        if (index >= 0) selected.add(index);
        else if (token[1] === "id") {
            const index = segments.findIndex(segment => segment[0] === "dynamic" &&
                segment[2] === "id");
            if (index >= 0) selected.add(index);
        }
    }
    const structural = segments.map((token, index) => ({token, index})).filter(({token, index}) =>
        token[0] !== "fixed" && !selected.has(index));
    const scope = prefix.filter(token => token[0] !== "fixed");
    if (scope.length > structural.length) return;
    for (let index = 0; index < scope.length; index++) {
        const token = scope[index]; const candidate = structural[index];
        if (token[0] !== candidate.token[0]) return;
        if (token[0] === "literal" && token[1] !== candidate.token[1]) return;
        if (token[0] === "dynamic" && (token[1] !== candidate.token[1] || token[2] !== candidate.token[2])) return;
        if (token[0] === "dynamic" && (row[`_key${token[1]}`] !== token[2] ||
            row[`_value${token[1]}`] !== token[3])) return;
        selected.add(candidate.index);
    }
    return segments.filter((token, index) => !selected.has(index));
};

const resolveStoredPath = (rows, path) => {
    const matches = rows.filter(row => row._collection === path.collection &&
        relativeSegments(row, pathSegments(path))?.length === 0);
    const unique = [...new Map(matches.map(row => [row._key, row])).values()];
    if (unique.length > 1) invalidPath("A record query must identify a single record.");
    if (!unique.length) return path;
    const actual = parseDatabasePath(pathFromSegments(path.collection, storedSegments(unique[0])), {allowField: false});
    return {...actual, key: unique[0]._key, field: path.field, kind: path.kind};
};

export const getRecord = async (storageKey, path) => getSubtree(storageKey, path);
// Adapt named read conditions to dynamic identities without changing stored rows.
const readRows = (rows, path) => {
    const conditions = parseDatabasePath(path, {allowField: false}).segments.filter(token => token[0] === "fixed");
    return rows.map(row => {
        const tokens = storedSegments(row);
        const values = {};
        const adapted = tokens.map(token => {
            const condition = token[0] === "dynamic" && conditions.find(entry => entry[1] === token[2] && entry[2] === token[3]);
            if (!condition) return token;
            values[condition[1]] = condition[2];
            return condition;
        });
        return Object.keys(values).length ? {...row, ...values, _key: JSON.stringify(adapted)} : row;
    });
};

// This read-only grammar does not affect writes, cursors or subscriptions.
export const readValue = (storageKey, rawPath) => {
    const {path, keyField, literal} = parseReadPath(rawPath);
    const readPath = path.map((segment, index) => {
        if (!index || typeof segment === "string" || Object.hasOwn(segment, "_")) return segment;
        const name = Object.keys(segment)[0];
        return segment[name] === name ? name : segment;
    });
    const parent = parseDatabasePath(readPath, {allowField: false});
    return transact(storageKey, "readonly", [storeName(parent.collection)], (transaction, setResult, abortWith) => {
        readStores(transaction, rows => {
            try {
                if (literal) {
                    const root = subtreeValue(rows, [parent.collection]);
                    setResult(readPath.slice(1).reduce((value, key) => value !== null && typeof value === "object" &&
                        Object.hasOwn(value, key) ? value[key] : undefined, root));
                    return;
                }
                const adapted = readRows(rows, readPath);
                if (keyField === undefined) {
                    const value = subtreeValue(adapted, readPath);
                    if (value !== undefined || JSON.stringify(path) === JSON.stringify(readPath)) {
                        setResult(value);
                        return;
                    }
                    // A concrete branch may be embedded in a record or assembled
                    // from child rows whose identity field differs from the branch name.
                    const concrete = path.findIndex((segment, index) => index && typeof segment !== "string" &&
                        !Object.hasOwn(segment, "_") && Object.entries(segment).some(([name, value]) => name === value));
                    const prefix = path.slice(0, concrete);
                    const base = subtreeValue(readRows(rows, prefix), prefix);
                    setResult(path.slice(concrete).reduce((value, segment) => {
                        const key = typeof segment === "string" ? segment : segment[Object.keys(segment).find(name => name !== "_")];
                        return value !== null && typeof value === "object" && Object.hasOwn(value, key) ? value[key] : undefined;
                    }, base));
                    return;
                }
                const identities = new Map();
                const selected = adapted.filter(row => {
                    const child = relativeSegments(row, parent.segments)?.[0];
                    if (!child || child[0] === "literal") return false;
                    const name = child[0] === "dynamic" ? child[2] : child[1];
                    if (name !== keyField) return false;
                    const key = child.at(-1);
                    const identity = JSON.stringify(child);
                    if (identities.has(key) && identities.get(key) !== identity) {
                        invalidPath("A collection read must identify each child uniquely.");
                    }
                    identities.set(key, identity);
                    return true;
                });
                setResult(subtreeValue(selected, readPath));
            } catch (error) { abortWith(error); }
        });
    });
};

export const addRecord = async (storageKey, rawPath, value) => {
    const path = interpretPath(rawPath);
    return transact(storageKey, "readwrite", [storeName(path.collection)], (transaction, _setResult, abortWith) => {
        readStores(transaction, rows => {
            try {
                if (subtreeValue(rows, rawPath) !== undefined) {
                    throw new DOMException("Record already exists.", "ConstraintError");
                }
                const resolvedValue = value instanceof Function ? value() : value;
                if (resolvedValue === undefined) invalidPath("Undefined values cannot be stored.");
                const changed = new Map();
                replaceTree(rows, changed, resolveStoredPath(rows, path), resolvedValue, Date.now());
                persistChanges(transaction, changed, abortWith);
            } catch (error) { abortWith(error); }
        });
    });
};
/** Allocate and insert in one transaction so an aborted write also rolls back the key generator. */
export const addGeneratedRecord = async (storageKey, createPath, makeValue) => {
    const {parentPath} = parseCreatePath(createPath);
    const collection = resolveCollectionPath(parentPath)[0];
    const name = storeName(collection);
    return transact(storageKey, "readwrite", [name], (transaction, setResult, abortWith) => {
        const store = transaction.objectStore(name);
        const allocate = () => {
            // The placeholder exists only inside this transaction and has no query indexes.
            const request = store.add({});
            request.onsuccess = () => {
                const rowId = request.result;
                const key = String(rowId);
                const rawPath = createRecordPath(createPath, key);
                const path = interpretPath(rawPath);
                readStores(transaction, rows => {
                    try {
                        if (rows.some(row => JSON.parse(row._key).some(token => token.at(-1) === key)) ||
                            subtreeValue(rows, rawPath) !== undefined) {
                            store.delete(rowId);
                            allocate();
                            return;
                        }
                        const value = makeValue(key);
                        if (!isRecord(value)) invalidPath("value must be a record object.");
                        const changed = new Map();
                        replaceTree(rows, changed, resolveStoredPath(rows, path), value, Date.now());
                        const identity = JSON.stringify([collection, path.key]);
                        changed.get(identity)._id = rowId;
                        persistChanges(transaction, changed, abortWith);
                        setResult(key);
                    } catch (error) { abortWith(error); }
                });
            };
        };
        allocate();
    });
};

export const putRecord = async (storageKey, path, value) => {
    interpretPath(path);
    return updateRecords(storageKey, [[path, value]]);
};
export const deleteRecord = async (storageKey, path) => {
    interpretPath(path);
    return updateRecords(storageKey, [[path, null]]);
};

export const subtreeValue = (records, rawPath) => {
    const path = parseDatabasePath(rawPath, {allowField: false});
    const prefix = pathSegments(path);
    const query = stored(path, undefined);
    let result;
    const rows = records.filter(row => row._collection === path.collection)
        .sort((a, b) => JSON.parse(a._key).length - JSON.parse(b._key).length);
    for (const row of rows) {
        const segments = relativeSegments(row, prefix);
        if (segments === undefined) {
            const suffix = relativeSegments(query, storedSegments(row));
            if (suffix?.length) {
                const nested = suffix.reduce((node, token) => node !== null && typeof node === "object" &&
                    Object.hasOwn(node, token.at(-1))
                    ? node[token.at(-1)]
                    : undefined, row.value);
                if (nested !== undefined) result = structuredClone(nested);
            }
            continue;
        }
        if (!segments.length) {
            result = structuredClone(row.value);
            continue;
        }
        if (!isRecord(result)) result = {};
        let target = result;
        for (const segment of segments.slice(0, -1)) {
            const name = segment.at(-1);
            if (!Object.hasOwn(target, name) || !isRecord(target[name])) {
                Object.defineProperty(target, name, {value: {}, enumerable: true, writable: true, configurable: true});
            }
            target = target[name];
        }
        Object.defineProperty(target, segments.at(-1).at(-1), {
            value: structuredClone(row.value), enumerable: true, writable: true, configurable: true
        });
    }
    return result;
};

export const getSubtree = (storageKey, rawPath) => {
    const path = parseDatabasePath(rawPath, {allowField: false});
    return transact(storageKey, "readonly", [storeName(path.collection)], (transaction, setResult) => {
        readStores(transaction, rows => setResult(subtreeValue(rows, rawPath)));
    });
};

export const getCursorChildren = (storageKey, rawPath, identityField) => {
    const path = parseDatabasePath(rawPath, {allowField: false});
    const prefix = pathSegments(path);
    return transact(storageKey, "readonly", [storeName(path.collection)], (transaction, setResult, abortWith) => {
        readStores(transaction, rows => {
            try {
                const entries = rows.flatMap(row => {
                    if (row._collection !== path.collection) return [];
                    const suffix = relativeSegments(row, prefix);
                    if (suffix?.length !== 1) return [];
                    const token = suffix[0];
                    return identityFieldName(token) === identityField
                        ? [[token.at(-1), subtreeValue(rows, pathFromSegments(path.collection, storedSegments(row)))]]
                        : [];
                });
                if (new Set(entries.map(([key]) => key)).size !== entries.length) {
                    invalidPath("A cursor child must identify a single record.");
                }
                setResult(Object.fromEntries(entries));
            } catch (error) { abortWith(error); }
        });
    });
};

const resolveBatchPath = (rawPath, rows) => {
    if (Array.isArray(rawPath)) return resolveStoredPath(rows, parseDatabasePath(rawPath));
    if (typeof rawPath !== "string") invalidPath("Batch paths must be strings or DatabasePath arrays.");
    const parts = rawPath.split("/");
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !part)) {
        invalidPath("A batch string path must address a record or a top-level field.");
    }
    const [collection, id, field] = parts;
    const matches = rows.filter(row => row._collection === collection &&
        JSON.parse(row._key).map(segment => segment.at(-1)).join("/") === id);
    if (matches.length > 1) invalidPath("Batch string path is ambiguous across named records.");
    if (matches.length) {
        const row = matches[0];
        return {
            ...interpretPath([collection, {id, _: true}, ...(field ? [field] : [])]),
            key: row._key,
            segments: storedSegments(row),
            keys: Object.fromEntries(Object.entries(row).filter(([key]) => /^_key\d+$/.test(key))),
            values: Object.fromEntries(Object.entries(row).filter(([key]) => /^_value\d+$/.test(key))),
            conditions: parseDatabasePath(pathFromSegments(collection, storedSegments(row)), {allowField: false}).conditions,
            id: row.id
        };
    }
    return interpretPath([collection, generatedSegment(id, []), ...(field ? [field] : [])]);
};

const applyCollection = (rows, changed, rawPath, value, merge, now, callback = false) => {
    if (value !== null && !isRecord(value)) invalidPath("A collection value must be a record object or null.");
    const collection = parseDatabasePath(rawPath, {allowField: false}).collection;
    const original = rows.filter(row => row._collection === collection);
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
            if (relativeSegments(row, prefix) !== undefined) setRow(row, undefined);
        }
    };
    const replaceChildren = (prefix, entries) => {
        for (const [key, child] of entries) {
            if (!key || key.includes("/")) invalidPath("Collection child keys must be non-empty and cannot contain '/'.");
            const existing = original.filter(row => relativeSegments(row, prefix)?.[0]?.at(-1) === key);
            const tokens = [...new Set(existing.map(row => JSON.stringify(relativeSegments(row, prefix)[0])))];
            if (tokens.length > 1) invalidPath("Collection child key is ambiguous across named records.");
            const path = (() => {
                const marker = tokens.length ? JSON.parse(tokens[0]) : undefined;
                const childSegment = marker
                    ? marker[0] === "literal"
                        ? marker[1]
                        : marker[0] === "fixed"
                            ? {[marker[1]]: marker[2]}
                            : {[marker[2]]: marker[3], _: marker[1]}
                    : generatedSegment(key, prefix);
                const parent = prefix.map(segment => segment[0] === "literal"
                    ? segment[1]
                    : segment[0] === "fixed"
                        ? {[segment[1]]: segment[2]}
                        : {[segment[2]]: segment[3], _: segment[1]});
                const parsed = resolveStoredPath(original, parseDatabasePath([collection, ...parent, childSegment]));
                return parsed;
            })();
            if (!callback) {
                replaceTree(rows, changed, path, child, now);
                continue;
            }
            const childPrefix = pathSegments(path);
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
                    const hasChildren = original.some(row => relativeSegments(row, nestedPrefix)?.length > 0);
                    const callbackCollection = isRecord(entry) && Object.values(entry).some(isRecord) &&
                        Object.values(entry).every(item => item === null || isRecord(item));
                    if (hasChildren || callbackCollection) {
                        replaceChildren(nestedPrefix, Object.entries(entry));
                    } else {
                        Object.defineProperty(rowValue, name, {
                            value: entry,
                            enumerable: true,
                            writable: true,
                            configurable: true
                        });
                    }
                }
            }
            const row = stored(path, recordValue(rowValue, previous?.value, now));
            delete row._updatedAt;
            setRow(row, row);
        }
    };
    const prefix = pathSegments(parseDatabasePath(rawPath, {allowField: false}));
    if (!merge) {
        removeEmbedded(rows, changed, collection, prefix);
        removeTree(prefix);
    }
    if (value !== null) replaceChildren(prefix, Object.entries(value));
};

const pathFromSegments = (collection, segments) => [collection, ...segments.map(segment =>
    segment[0] === "literal"
        ? segment[1]
        : segment[0] === "fixed"
            ? {[segment[1]]: segment[2]}
            : {[segment[2]]: segment[3], _: segment[1]})];

const removeDescendants = (rows, changed, collection, prefix) => {
    const current = new Map(rows.map(row => [JSON.stringify([row._collection, row._key]), row]));
    for (const [identity, row] of changed) {
        if (row) current.set(identity, row);
        else current.delete(identity);
    }
    for (const [identity, row] of current) {
        if (row._collection === collection && relativeSegments(row, prefix) !== undefined) {
            changed.set(identity, undefined);
        }
    }
};

const removeEmbedded = (rows, changed, collection, address) => {
    const parsed = parseDatabasePath(pathFromSegments(collection, address), {allowField: false});
    const target = stored(parsed, undefined);
    const current = new Map(rows.map(row => [JSON.stringify([row._collection, row._key]), row]));
    for (const [identity, row] of changed) {
        if (row) current.set(identity, row);
        else current.delete(identity);
    }
    for (const [identity, row] of current) {
        if (row._collection !== collection || !isRecord(row.value)) continue;
        const suffix = relativeSegments(target, storedSegments(row));
        if (!suffix?.length) continue;
        const value = structuredClone(row.value);
        let node = value;
        const parents = [];
        for (const token of suffix.slice(0, -1)) {
            const name = token.at(-1);
            if (!Object.hasOwn(node, name) || !isRecord(node[name])) { node = undefined; break; }
            parents.push([node, name]);
            node = node[name];
        }
        const name = suffix.at(-1).at(-1);
        if (!node || !Object.hasOwn(node, name)) continue;
        delete node[name];
        for (const [parent, name] of parents.reverse()) {
            if (!Object.keys(parent[name]).length) delete parent[name];
            else break;
        }
        const path = parseDatabasePath(pathFromSegments(collection, storedSegments(row)), {allowField: false});
        changed.set(identity, stored({...path, key: row._key}, value));
    }
};

const partitionValue = (rows, changed, collection, prefix, value, now) => {
    if (!isRecord(value) || increments.has(value)) return value;
    const result = {};
    for (const [name, entry] of Object.entries(value)) {
        if (entry === undefined) invalidPath("Undefined values cannot be stored.");
        const children = rows.filter(row => row._collection === collection)
            .map(row => relativeSegments(row, prefix)?.[0])
            .filter(token => token && token[0] !== "literal" && token.at(-1) === name);
        const identities = [...new Set(children.map(token => JSON.stringify(token)))];
        if (identities.length > 1) invalidPath("Collection child key is ambiguous across named records.");
        if (identities.length) {
            const child = parseDatabasePath(pathFromSegments(collection, [...prefix, JSON.parse(identities[0])]));
            replaceTree(rows, changed, resolveStoredPath(rows, child), entry, now);
            continue;
        }
        const nested = [...prefix, ["literal", name]];
        const hasChildren = rows.some(row => row._collection === collection && relativeSegments(row, nested)?.length > 0);
        if (hasChildren && isRecord(entry) && !increments.has(entry)) {
            applyCollection(rows, changed, pathFromSegments(collection, nested), entry, false, now);
        } else {
            Object.defineProperty(result, name, {value: entry, enumerable: true, writable: true, configurable: true});
        }
    }
    return result;
};

const replaceTree = (rows, changed, path, value, now) => {
    if (value === undefined) invalidPath("Undefined values cannot be stored.");
    const prefix = pathSegments(path);
    const address = path.field ? [...prefix, ["literal", path.field]] : prefix;
    const identity = JSON.stringify(keyFor(path));
    const original = rows.find(row => row._collection === path.collection && row._key === path.key);
    const previous = path.field && changed.has(identity) ? changed.get(identity) : changed.get(identity) ?? original;
    removeEmbedded(rows, changed, path.collection, address);
    removeDescendants(rows, changed, path.collection, address);
    if (!path.field) {
        if (value === null) return;
        const next = partitionValue(rows, changed, path.collection, prefix, value, now);
        const row = stored(path, recordValue(next, previous?.value, now));
        delete row._updatedAt;
        changed.set(identity, row);
        return;
    }
    if (previous && !isRecord(previous.value)) invalidPath("A field update requires an object record.");
    const next = {...previous?.value};
    if (value === null) delete next[path.field];
    else {
        const hasChildren = rows.some(row => row._collection === path.collection && relativeSegments(row, address)?.length > 0);
        if (hasChildren && isRecord(value) && !increments.has(value)) {
            applyCollection(rows, changed, pathFromSegments(path.collection, address), value, false, now);
            delete next[path.field];
        } else {
            Object.defineProperty(next, path.field, {
                value: resolveValue(value, next[path.field], now),
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
    }
    if (previous || Object.keys(next).length) {
        const row = stored(path, recordValue(next, previous?.value, now));
        delete row._updatedAt;
        changed.set(identity, Object.keys(row.value).length ? row : undefined);
    }
};

const checkBatchPaths = prepared => {
    const addresses = prepared.map(({path}) => {
        const segments = [...pathSegments(path), ...(path.field ? [["literal", path.field]] : [])];
        return {collection: path.collection, segments, row: stored({...path, key: JSON.stringify(segments)}, undefined)};
    });
    for (let index = 0; index < addresses.length; index++) {
        const current = addresses[index];
        for (const other of addresses.slice(index + 1)) {
            if (current.collection === other.collection &&
                (relativeSegments(current.row, other.segments) !== undefined ||
                    relativeSegments(other.row, current.segments) !== undefined)) {
                invalidPath("Conflicting batch paths.");
            }
        }
    }
};

// Resolve logical identities without scanning the store; retain physical IDs on replacement.
const persistChanges = (transaction, changed, abortWith) => {
    const entries = [...changed];
    const next = () => {
        if (!entries.length) return;
        const [identity, row] = entries.shift();
        const [collection, key] = JSON.parse(identity);
        const store = transaction.objectStore(storeName(collection));
        const request = store.index("_identity").getKey(key);
        request.onsuccess = () => {
            try {
                if (!row) {
                    if (request.result === undefined) next();
                    else store.delete(request.result).onsuccess = next;
                    return;
                }
                const rowId = request.result ?? row._id;
                const save = id => {
                    store.put(encodeRow({...row, ...(id === undefined ? {} : {_id: id})}, store)).onsuccess = next;
                };
                const supplied = numericKey(JSON.parse(key).at(-1)?.at(-1));
                if (rowId === undefined && supplied !== undefined) {
                    // Serialize slots too: two logical paths can have the same supplied key.
                    const slot = store.getKey(supplied);
                    slot.onsuccess = () => {
                        try { save(slot.result === undefined ? supplied : undefined); } catch (error) { abortWith(error); }
                    };
                } else save(rowId);
            } catch (error) { abortWith(error); }
        };
    };
    next();
};

const applyBatch = (transaction, entries, merge, abortWith) => {
    readStores(transaction, rows => {
        try {
            const named = entries.filter(([rawPath]) => Array.isArray(rawPath))
                .map(([rawPath]) => parseDatabasePath(rawPath)).filter(path => path.kind !== "collection");
            const virtual = named.filter(path => !rows.some(row => row._collection === path.collection &&
                relativeSegments(row, pathSegments(path))?.length === 0))
                .map(path => stored(path, {}));
            const prepared = entries.map(([rawPath, value]) => ({path: resolveBatchPath(rawPath, [...rows, ...virtual]), value}));
            checkBatchPaths(prepared);
            const changed = new Map();
            const now = Date.now();
            for (const {path, value} of prepared) {
                if (path.kind === "collection") {
                    applyCollection(rows, changed, pathFromSegments(path.collection, pathSegments(path)), value, merge, now);
                    continue;
                }
                if (!merge) {
                    replaceTree(rows, changed, path, value, now);
                    continue;
                }
                if (!isRecord(value)) invalidPath("changes must be a record object.");
                for (const [field, entry] of Object.entries(value)) {
                    replaceTree(rows, changed, {...path, field, kind: "field"}, entry, now);
                }
            }
            persistChanges(transaction, changed, abortWith);
        } catch (error) { abortWith(error); }
    });
};

export const updateRecords = (storageKey, entries, {merge = false} = {}) => {
    const names = entries.map(([path]) => storeName(Array.isArray(path)
        ? parseDatabasePath(path).collection
        : typeof path === "string" ? path.split("/")[0] : invalidPath("Invalid batch path.")));
    return transact(storageKey, "readwrite", names.length ? names : storeNames(storageKey),
        (transaction, setResult, abortWith) => applyBatch(transaction, entries, merge, abortWith));
};

export const updateRecord = (storageKey, rawPath, callback) => {
    const path = parseDatabasePath(rawPath);
    return transact(storageKey, "readwrite", [storeName(path.collection)], (transaction, setResult, abortWith) => {
        readStores(transaction, rows => {
            try {
                const current = subtreeValue(rows, rawPath) ?? null;
                const updated = applyUpdate(callback, structuredClone(current));
                const changed = replaceValue(rows, rawPath, resolveStoredPath(rows, path), updated ?? null);
                const saved = new Map(rows.map(row => [JSON.stringify([row._collection, row._key]), row]));
                for (const [identity, row] of changed) {
                    if (row) saved.set(identity, row);
                    else saved.delete(identity);
                }
                persistChanges(transaction, changed, abortWith);
                setResult(subtreeValue([...saved.values()], rawPath) ?? null);
            } catch (error) { abortWith(error); }
        });
    });
};

const replaceValue = (rows, rawPath, path, value) => {
    const changed = new Map();
    const now = Date.now();
    if (path.kind === "collection") {
        applyCollection(rows, changed, rawPath, value, false, now, true);
        return changed;
    }
    replaceTree(rows, changed, path, value, now);
    return changed;
};

export const getAllRecords = storageKey => transact(storageKey, "readonly", undefined,
    (transaction, setResult) => readStores(transaction, setResult));

/** Resolve an existing immediate child back to its stored named path. */
export const getChildRecordPath = async (storageKey, rawPath, key, identityField) => {
    const path = parseDatabasePath(rawPath, {allowField: false});
    const prefix = pathSegments(path);
    const rows = await getAllRecords(storageKey);
    const matches = rows.filter(row => {
        if (row._collection !== path.collection) return false;
        const suffix = relativeSegments(row, prefix);
        return suffix?.length === 1 && suffix[0].at(-1) === key && (identityField === undefined ||
            identityFieldName(suffix[0]) === identityField);
    });
    if (matches.length > 1) invalidPath("A cursor child must identify a single record.");
    return matches.length ? pathFromSegments(path.collection, storedSegments(matches[0])) : undefined;
};

// Returns {id, value} entries. Dynamic segment names are indexed by their explicit level;
// fixed named segments filter by their field names, independent of path position.
export const getRecordsByType = async (storageKey, path) => {
    const {collection, keys, conditions} = typeQuery(path);
    return transact(storageKey, "readonly", [storeName(collection)], (transaction, setResult) => {
        const store = transaction.objectStore(storeName(collection));
        const request = store.getAll();
        request.onsuccess = () => setResult(request.result.map(row => decodeRow(row, collection)).filter(Boolean)
            .filter(row => row._collection === collection &&
                Object.entries(keys).every(([name, value]) => row[name] === value) &&
                Object.entries(conditions).every(([name, value]) => Object.hasOwn(row, name) && row[name] === value))
            .map(({id, value}) => ({id, value})));
    });
};
