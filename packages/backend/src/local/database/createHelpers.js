import {openLocalDatabase} from "../../../../common/src/localDatabase";
import parseCreatePath from "../../../../database/src/common/parseCreatePath";
import resolvePath from "../../../../database/src/common/resolvePath";
import validatePath from "../../../../database/src/common/validatePath";
import {fail} from "../../../../common";

const storeName = collection => {
    if (typeof collection !== "string" || !collection || collection.includes("/")) fail("database/invalid-argument", "Invalid Local collection.");
    return collection;
};

const numericKey = key => typeof key === "string" && /^[1-9]\d*$/.test(key) && Number.isSafeInteger(Number(key))
    ? Number(key)
    : undefined;

const invalidPath = message => fail("database/invalid-argument", message);

const TIMESTAMP = Symbol("LocalDatabase.TIMESTAMP");

const increments = new WeakMap();

const increment = delta => {
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

const resolveCollectionPath = path => {
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
const parseDatabasePath = (path, {allowField = true} = {}) => {
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

const interpretPath = (path, options) => {
    const parsed = parseDatabasePath(path, options);
    if (parsed.kind === "collection") invalidPath("A record path must include a named identity segment.");
    return parsed;
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

const createRecordPath = (rawPath, key) => {
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

const addRecord = async (storageId, rawPath, value, transact = transactPrepared) => {
    const path = interpretPath(rawPath);
    return transact(storageId, "readwrite", [storeName(path.collection)], (transaction, _setResult, abortWith) => {
        readStores(transaction, rows => {
            try {
                if (subtreeValue(rows, rawPath) !== undefined) {
                    throw new DOMException("Record already exists.", "ConstraintError");
                }
                if (value === undefined) invalidPath("Undefined values cannot be stored.");
                const changed = new Map();
                replaceTree(rows, changed, resolveStoredPath(rows, path), value, Date.now());
                persistChanges(transaction, changed, abortWith);
            } catch (error) { abortWith(error); }
        });
    });
};

const subtreeValue = (records, rawPath) => {
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

export {invalidPath, resolveCollectionPath, storeName, parseDatabasePath, relativeSegments, storedSegments, readStores, subtreeValue, interpretPath, pathSegments, pathFromSegments, generatedSegment, resolveStoredPath, stored, isRecord, applyCollection, replaceTree, persistChanges, TIMESTAMP, increment, createRecordPath, addRecord};

// Stored path keys are JSON arrays of literal, fixed and dynamic identity tokens.
const identityTokens = pathKey => JSON.parse(pathKey);

export const identityField = token => token?.[0] === "dynamic"
    ? token[2]
    : token?.[0] === "fixed" ? token[1] : undefined;

export const IDENTITY_INDEX = Object.freeze({keyPath: "_local.path", unique: true});

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const set = (object, name, value) => Object.defineProperty(object, name,
    {value, enumerable: true, configurable: true, writable: true});

// Keep public object fields once. Only injected or overwritten fields need
// reconstruction metadata; scalar and array values have no object fields.
export const encodeRow = (row, store) => {
    const object = record(row.value);
    const fields = object ? {...row.value} : {};
    const tokens = JSON.parse(row._key).map(token => token[0] === "fixed"
        ? [token[0], token[1], Object.hasOwn(row, token[1]) ? row[token[1]] : token[2]]
        : token[0] === "dynamic" ? [token[0], token[1], token[2], row[`_value${token[1]}`] ?? token[3]] : token);
    const metadata = {path: JSON.stringify(tokens)};
    if (!object) metadata.value = row.value;
    const originals = {};
    const added = new Set();
    const project = (name, value) => {
        if (object && Object.hasOwn(row.value, name)) {
            if (!Object.is(row.value[name], value)) set(originals, name, row.value[name]);
        } else if (object) added.add(name);
        set(fields, name, value);
    };
    const last = tokens.at(-1);
    const leaf = last?.[0] === "fixed" ? last[1] : last?.[0] === "dynamic" ? last[2] : undefined;
    const projected = new Set();
    // Project ancestor identities only for compound indexes describing this child.
    for (const name of store.indexNames) {
        if (name === "_identity") continue;
        const paths = store.index(name).keyPath;
        if (Array.isArray(paths) && paths.includes(leaf)) paths.forEach(path => projected.add(path));
        else if (paths === leaf) projected.add(leaf);
    }
    for (const token of tokens) {
        if (token[0] === "literal") continue;
        const name = token[0] === "fixed" ? token[1] : token[2];
        if (!projected.has(name)) continue;
        const value = token === last && tokens.length > 1 && token[0] === "fixed" && token[1] === token[2]
            ? row.value : token.at(-1);
        project(name, value);
    }
    for (const name of ["_id", "_local"]) {
        if (object && Object.hasOwn(row.value, name)) set(originals, name, row.value[name]);
        added.delete(name);
    }
    if (added.size) metadata.added = [...added];
    if (Object.keys(originals).length) metadata.originals = originals;
    delete fields._id;
    return {...fields, ...(row._id === undefined ? {} : {_id: row._id}), _local: metadata};
};

const logicalRow = (collection, path, value, id) => {
    const row = {};
    if (record(value)) {
        for (const name of Object.keys(value)) {
            if (!["_collection", "_key", "_id", "value", "id"].includes(name) && !/^_(?:key|value)\d+$/.test(name)) {
                set(row, name, name);
            }
        }
    }
    let level = -1;
    for (const token of JSON.parse(path)) {
        if (token[0] === "fixed") set(row, token[1], token[2]);
        if (token[0] === "dynamic") {
            row[`_key${token[1]}`] = token[2];
            row[`_value${token[1]}`] = token[3];
            if (token[1] > level) { row.id = token[3]; level = token[1]; }
        }
    }
    return {...row, _collection: collection, _key: path, _id: id, value};
};

export const decodeRow = (row, collection) => {
    const metadata = row?._local;
    if (typeof metadata?._key === "string") {
        // Read the previous envelope during its atomic schema upgrade.
        return {...logicalRow(collection, metadata._key, metadata.value, row._id), ...metadata, _id: row._id};
    }
    if (typeof metadata?.path !== "string") return undefined;
    let value;
    if (Object.hasOwn(metadata, "value")) value = metadata.value;
    else {
        value = {...row};
        delete value._id;
        delete value._local;
        for (const name of metadata.added ?? []) delete value[name];
        for (const [name, original] of Object.entries(metadata.originals ?? {})) set(value, name, original);
    }
    return logicalRow(collection, metadata.path, value, row._id);
};

export const runTransaction = async (database, mode, names, run) => {
    try {
        return await new Promise((resolve, reject) => {
            const selected = names;
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

const transactPrepared = async (storageId, mode, names, run) => {
    if (names.some(name => name.startsWith("$"))) invalidPath("Service stores cannot contain application records.");
    const database = await openLocalDatabase(storageId);
    return runTransaction(database, mode, names, run);
};
