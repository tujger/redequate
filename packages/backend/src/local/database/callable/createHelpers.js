import {isTimestamp} from "../../timestamp";
import {incrementDelta, isIncrement} from "../../increment";
import {openLocalDatabase} from "../../../../../common/src/localDatabase";
import {fail} from "../../../../../common";
import {captureWrites, publishWrites} from "../writeEvents";
import parseCreatePath from "../../../../../database/src/common/parseCreatePath";
import {decodeRecordValue, encodeRecordValue, setRecordField} from "../recordValue";

const invalid = message => fail("database/invalid-argument", message);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const set = (object, name, value) => Object.defineProperty(object, name,
    {value, enumerable: true, writable: true, configurable: true});
const at = (object, names) => names.reduce((value, name) => value !== null && typeof value === "object" &&
    Object.hasOwn(value, name) ? value[name] : undefined, object);
const parts = name => name.split(".");
const assign = (object, names, value, remove = false) => {
    let node = object;
    for (let index = 0; index < names.length - 1; index++) {
        const name = names[index];
        if (node[name] === null || typeof node[name] !== "object" || !Object.hasOwn(node, name)) {
            set(node, name, /^(0|[1-9]\d*)$/.test(names[index + 1]) ? [] : {});
        }
        node = node[name];
    }
    if (remove) delete node[names.at(-1)];
    else set(node, names.at(-1), value);
};
const resolveValue = (value, previous, now) => {
    if (value === undefined) invalid("Undefined values cannot be stored.");
    if (isTimestamp(value)) return now;
    if (isIncrement(value)) {
        const result = (typeof previous === "number" && Number.isFinite(previous) ? previous : 0) + incrementDelta(value);
        if (!Number.isFinite(result)) invalid("increment result must be finite.");
        return result;
    }
    if (Array.isArray(value)) return value.map((item, index) => resolveValue(item, previous?.[index], now));
    if (isRecord(value)) {
        const result = {};
        for (const [name, item] of Object.entries(value)) set(result, name, resolveValue(item, previous?.[name], now));
        return result;
    }
    return value;
};

export const validateCollectionPath = rawPath => {
    if (typeof rawPath !== "string" && !Array.isArray(rawPath)) invalid("Expected a collection path.");
    const path = typeof rawPath === "string" ? rawPath.split("/").filter(Boolean) : [...rawPath];
    if (!path.length) invalid("Expected a collection path.");
    if (path[0] !== null && typeof path[0] === "object") {
        path[0] = path[0][Object.keys(path[0]).find(name => name !== "_")];
    }
    if (typeof path[0] !== "string" || !path[0] || path[0].includes("/") || path[0].startsWith("$")) {
        invalid("Invalid application collection.");
    }
    return path;
};

export const createRecordPath = (rawPath, key) => {
    const {parentPath, fieldName} = parseCreatePath(rawPath);
    return [...parentPath, {[fieldName]: key}];
};

const requestResult = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

export const runTransaction = async (database, mode, names, operation) => {
    let previous, value;
    const storageId = database.name;
    let result;
    try {
        result = await new Promise((resolve, reject) => {
            const transaction = database.transaction([...new Set(names)], mode);
            let result, failure;
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Local transaction aborted."));
            Promise.resolve().then(async () => {
                if (mode === "readwrite") previous = await captureWrites(storageId, transaction);
                const result = await operation(transaction);
                if (mode === "readwrite") value = await captureWrites(storageId, transaction);
                return result;
            }).then(value => { result = value; }, error => {
                failure = error;
                try { transaction.abort(); } catch (_) { reject(error); }
            });
        });
    } finally { database.close(); }
    if (previous) publishWrites(storageId, previous, value);
    return result;
};

const indexes = store => [...store.indexNames].map(name => {
    const index = store.index(name);
    return {index, fields: Array.isArray(index.keyPath) ? [...index.keyPath] : [index.keyPath]};
});
const nativeKey = value => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) ? Number(value) : value;
const keyValue = (name, value) => name === "_id" ? nativeKey(value) : value;
const uniqueIndexes = store => indexes(store).filter(({index}) => index.unique && !index.multiEntry);

const address = (store, rawPath) => {
    const path = validateCollectionPath(rawPath);
    const segments = path.slice(1);
    if (!store.indexNames.length) {
        return {conditions: {}, property: segments.map(segment => typeof segment === "string" ? segment :
            segment[Object.keys(segment).find(name => name !== "_")]), single: true, singleton: true};
    }
    const conditions = {};
    const property = [];
    const indexed = new Set(indexes(store).flatMap(({fields}) => fields));
    indexed.add("_id");
    let nested = false;
    if (typeof rawPath === "string" && segments.length) {
        const candidates = uniqueIndexes(store).filter(({fields}) => fields.length <= segments.length);
        if (candidates.length !== 1) invalid("A string record path requires one unambiguous unique index.");
        const {fields} = candidates[0];
        fields.forEach((field, index) => { conditions[field] = keyValue(field, segments[index]); });
        property.push(...segments.slice(fields.length));
    } else {
        for (const segment of segments) {
            if (typeof segment === "string") { nested = true; property.push(segment); continue; }
            const name = Object.keys(segment).find(name => name !== "_");
            const value = segment[name];
            const fieldAddress = Object.keys(conditions).length && name === value;
            if (!nested && !fieldAddress && indexed.has(name)) conditions[name] = keyValue(name, value);
            else if (!nested && !Object.keys(conditions).length) invalid(`No declared index for field ${name}.`);
            else { nested = true; property.push(value); }
        }
    }
    const unique = Object.hasOwn(conditions, "_id") || uniqueIndexes(store)
        .some(({fields}) => fields.every(field => Object.hasOwn(conditions, field)));
    const single = unique || Object.keys(conditions).length > 0 && !uniqueIndexes(store).length;
    if (property.length && !single) invalid(`A nested property requires a unique indexed record: ${JSON.stringify(rawPath)}.`);
    return {conditions, property, single, unique, singleton: false};
};

const queryRows = async (store, conditions, options = {}) => {
    const field = options.orderBy === undefined ? undefined : (typeof options.orderBy === "string"
        ? options.orderBy : options.orderBy.map(segment => typeof segment === "string" ? segment :
            segment[Object.keys(segment).find(name => name !== "_")]).join("/")).replaceAll("/", ".");
    const bounded = options.equalTo !== undefined || options.start !== undefined || options.end !== undefined;
    if (field && bounded) {
        const source = indexes(store).find(({fields}) => {
            const position = fields.indexOf(field);
            return position >= 0 && fields.slice(0, position).every(name => Object.hasOwn(conditions, name));
        });
        if (!source) invalid(`No declared index supports the requested range for ${field}.`);
        const {index, fields} = source;
        const position = fields.indexOf(field);
        const prefix = fields.slice(0, position).map(name => conditions[name]);
        const valid = value => typeof value === "string" || typeof value === "number" && Number.isFinite(value);
        const bound = value => Array.isArray(index.keyPath) ? [...prefix, value] : value;
        let range;
        if (options.equalTo !== undefined) {
            if (!valid(options.equalTo)) return [];
            const key = bound(options.equalTo);
            range = position === fields.length - 1 ? IDBKeyRange.only(key)
                : IDBKeyRange.bound(key, [...key, []], false, true);
        } else {
            const lower = options.start === undefined ? (prefix.length ? prefix : undefined) : bound(options.start);
            const upper = options.end === undefined ? (prefix.length ? [...prefix, []] : undefined)
                : position === fields.length - 1 ? bound(options.end) : [...bound(options.end), []];
            if ([options.start, options.end].some(value => value !== undefined && !valid(value))) invalid("Native range bounds must be strings or finite numbers.");
            range = lower === undefined ? IDBKeyRange.upperBound(upper)
                : upper === undefined ? IDBKeyRange.lowerBound(lower) : IDBKeyRange.bound(lower, upper);
        }
        const rows = await requestResult(index.getAll(range));
        return [...new Map(rows.map(row => [row._id, row])).values()]
            .filter(row => Object.entries(conditions).every(([name, value]) => Object.is(at(row, parts(name)), value)));
    }
    if (Object.hasOwn(conditions, "_id")) {
        const value = await requestResult(store.get(conditions._id));
        return value === undefined ? [] : [value];
    }
    const names = Object.keys(conditions);
    if (!names.length) return requestResult(store.getAll());
    const candidates = indexes(store).map(entry => {
        let count = 0;
        while (count < entry.fields.length && Object.hasOwn(conditions, entry.fields[count])) count++;
        return {...entry, count};
    }).filter(({count}) => count).sort((a, b) => b.count - a.count || a.fields.length - b.fields.length);
    if (!candidates.length) invalid("No declared index matches this lookup.");
    const {index, fields, count} = candidates[0];
    const values = fields.slice(0, count).map(field => conditions[field]);
    const key = Array.isArray(index.keyPath) ? values : values[0];
    const range = count === fields.length ? IDBKeyRange.only(key)
        : IDBKeyRange.bound(values, [...values, []], false, true);
    const rows = await requestResult(index.getAll(range));
    return rows.filter(row => names.every(name => Object.is(at(row, parts(name)), conditions[name])));
};

const singleton = async store => {
    const rows = await requestResult(store.getAll(undefined, 2));
    if (rows.length > 1) invalid("An unindexed store must contain a single document.");
    return rows[0];
};

const identityField = (store, conditions, requested) => {
    if (requested) {
        if (requested !== "_id" && !indexes(store).some(({fields}) => fields.includes(requested))) {
            invalid(`No declared index for field ${requested}.`);
        }
        return requested;
    }
    const index = uniqueIndexes(store).find(({fields}) => fields.slice(0, -1)
        .every(field => Object.hasOwn(conditions, field)));
    return index?.fields.at(-1) ?? "_id";
};

const recordValue = (store, row, conditions = {}, keyField) => {
    const unique = uniqueIndexes(store);
    const fields = unique.flatMap(({fields}) => fields);
    if (!unique.length) fields.push(...Object.keys(conditions));
    if (keyField) fields.push(keyField);
    return decodeRecordValue(row, fields);
};

const collectionValue = (store, rows, conditions, keyField) => {
    if (!rows.length) return undefined;
    const field = identityField(store, conditions, keyField);
    const result = {};
    for (const row of rows) {
        const key = at(row, parts(field));
        if (key === undefined) invalid(`Record has no ${field} collection key.`);
        if (Object.hasOwn(result, String(key))) invalid("A collection read must identify each child uniquely.");
        set(result, String(key), recordValue(store, row, conditions, field));
    }
    return result;
};

const checkQuery = (store, options) => {
    if (options.orderBy === undefined) {
        if (!store.indexNames.length && [options.equalTo, options.start, options.end].some(value => value !== undefined)) {
            invalid("Unindexed stores do not support queries.");
        }
        return;
    }
    const path = typeof options.orderBy === "string" ? options.orderBy : options.orderBy.map(segment =>
        typeof segment === "string" ? segment : segment[Object.keys(segment).find(name => name !== "_")]).join("/");
    const field = path.replaceAll("/", ".");
    if (!field && store.indexNames.length) return;
    if (!indexes(store).some(({fields}) => fields.includes(field))) invalid(`No declared index for field ${path}.`);
};

export const readStore = async (store, path, {keyField, ...options} = {}) => {
    checkQuery(store, options);
    const target = address(store, path);
    if (target.singleton) return at(recordValue(store, await singleton(store)), target.property);
    const rows = await queryRows(store, target.conditions, options);
    if (target.single && (target.unique || !keyField)) {
        if (rows.length > 1) invalid("A record path must identify a single record.");
        return at(recordValue(store, rows[0], target.conditions), target.property);
    }
    return collectionValue(store, rows, target.conditions, keyField);
};

const withIdentity = (value, conditions, previous) => {
    if (!isRecord(value)) invalid("An indexed record must be an object.");
    const result = {...value};
    for (const [name, expected] of Object.entries(conditions)) {
        const supplied = at(result, parts(name));
        if (supplied !== undefined && !Object.is(supplied, expected)) invalid(`Record conflicts with path field ${name}.`);
        setRecordField(result, parts(name), expected);
    }
    if (previous?._id !== undefined) {
        if (result._id !== undefined && result._id !== previous._id) invalid("The native primary key cannot be changed.");
        setRecordField(result, ["_id"], previous._id);
    }
    return result;
};

const mergeValue = (previous, changes) => {
    const result = isRecord(previous) ? {...previous} : {};
    for (const [name, value] of Object.entries(changes)) {
        if (value === null) delete result[name];
        else set(result, name, value);
    }
    return result;
};

export const writeStore = async (store, rawPath, value, {merge = false, create = false, now = Date.now()} = {}) => {
    const target = address(store, rawPath);
    if (!target.singleton && !target.single && !target.property.length && !create) {
        const rows = await queryRows(store, target.conditions);
        const field = identityField(store, target.conditions);
        if (value !== null && !isRecord(value)) invalid("Collection changes must be an object or null.");
        const primaryKeys = new Map(rows.map(row => [String(at(row, parts(field))), row._id]));
        if (!merge && value !== null) value = resolveValue(value, collectionValue(store, rows, target.conditions), now);
        if (!merge || value === null) for (const row of rows) await requestResult(store.delete(row._id));
        for (const [key, child] of Object.entries(value ?? {})) {
            const path = [store.name, ...Object.entries(target.conditions).map(([name, value]) => ({[name]: String(value)})), {[field]: key}];
            if (!merge && field !== "_id" && primaryKeys.has(key)) path.push({_id: String(primaryKeys.get(key))});
            await writeStore(store, path, child, {merge, now});
        }
        return value;
    }
    let previous;
    if (target.singleton) previous = await singleton(store);
    else {
        const rows = await queryRows(store, target.conditions);
        if (rows.length > 1) invalid("A write requires a unique record path.");
        previous = rows[0];
    }
    const decoded = recordValue(store, previous, target.conditions);
    const current = at(decoded, target.property);
    if (value === undefined) invalid("Undefined values cannot be stored.");
    if (create && current !== undefined) throw new DOMException("Record already exists.", "ConstraintError");
    if (value === null && target.property.length && current === undefined) return null;
    let next;
    if (target.property.length) {
        next = decoded !== null && typeof decoded === "object" ? structuredClone(decoded) : {};
        if (value === null) assign(next, target.property, undefined, true);
        else {
            const prepared = merge ? mergeValue(current, value) : value;
            assign(next, target.property, resolveValue(prepared, current, now));
        }
    } else if (value === null) {
        if (previous) await requestResult(store.delete(previous._id));
        return null;
    } else {
        next = resolveValue(merge && isRecord(value) ? mergeValue(decoded, value) : value, decoded, now);
    }
    next = encodeRecordValue(next);
    for (const {fields} of indexes(store)) for (const field of fields) {
        const prior = at(previous, parts(field));
        if (at(decoded, parts(field)) === undefined && at(next, parts(field)) === undefined && prior !== undefined) {
            setRecordField(next, parts(field), prior);
        }
    }
    next = withIdentity(next, target.conditions, previous);
    const savedKey = await requestResult(create && !target.property.length ? store.add(next) : store.put(next));
    setRecordField(next, ["_id"], savedKey);
    return at(recordValue(store, next, target.conditions), target.property);
};

export const assertNonOverlapping = (transaction, entries) => {
    const targets = entries.map(([path]) => {
        const collection = validateCollectionPath(path)[0];
        return {collection, ...address(transaction.objectStore(collection), path)};
    });
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i], b = targets[j];
        if (a.collection !== b.collection) continue;
        const conflicting = Object.keys(a.conditions).some(name => Object.hasOwn(b.conditions, name) && a.conditions[name] !== b.conditions[name]);
        if (conflicting) continue;
        const n = Math.min(a.property.length, b.property.length);
        if (a.property.slice(0, n).every((name, index) => name === b.property[index])) invalid("Batch paths must not overlap.");
    }
};

export const childRecordPath = (store, path, key, keyField) => {
    const target = address(store, path);
    const base = [store.name, ...Object.entries(target.conditions).map(([name, value]) => ({[name]: String(value)})), ...target.property];
    if (target.singleton || target.single) return [...base, {[key]: key}];
    return [...base, {[identityField(store, target.conditions, keyField)]: key}];
};

const writeObservers = new Map();
export const observeWrites = (storageId, callback) => {
    if (!writeObservers.has(storageId)) writeObservers.set(storageId, new Set());
    writeObservers.get(storageId).add(callback);
    return () => {
        const callbacks = writeObservers.get(storageId);
        callbacks?.delete(callback);
        if (!callbacks?.size) writeObservers.delete(storageId);
    };
};

export const notifyWrites = async (storageId, collections) => {
    collections = [...new Set(collections)];
    if (!collections.length) return;
    await Promise.allSettled(collections.flatMap(collection => [...(writeObservers.get(storageId) ?? [])]
        .map(callback => Promise.resolve().then(() => callback(collection)))));
    if (typeof globalThis.BroadcastChannel !== "function") return;
    let channel;
    try {
        channel = new globalThis.BroadcastChannel(`redequate:local:${storageId}:changes`);
        channel.postMessage({collections});
    } catch (_) { /* Notification failure cannot invalidate a committed record. */ }
    finally { channel?.close(); }
};

export const addRecord = async (storageId, path, value) => {
    const collection = validateCollectionPath(path)[0];
    const database = await openLocalDatabase(storageId);
    const result = await runTransaction(database, "readwrite", [collection], transaction =>
        writeStore(transaction.objectStore(collection), path, value, {create: true}));
    await notifyWrites(storageId, [collection]);
    return result;
};
