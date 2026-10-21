import compareKeys, {integerKey} from "../common/compareKeys";

// IDB compares strings lexically. Firebase places signed integer keys first,
// sorting them numerically and breaking equal-number ties by key length.
export const orderedKey = key => {
    const number = integerKey(key);
    return number !== null
        ? [0, number, key.length, key]
        : [1, key];
};

export const orderedValue = value => value === null
    ? [0]
    : typeof value === "boolean"
        ? [1, Number(value)]
        : typeof value === "number" && Number.isFinite(value)
            ? [2, value]
            : typeof value === "string" ? [3, value] : undefined;

export const childKey = row => {
    const tokens = JSON.parse(row._key);
    if (tokens.length !== 1) return undefined;
    return tokenKey(row, tokens[0]);
};

const tokenKey = (row, token) => {
    return token[0] === "dynamic"
        ? row[`_value${token[1]}`] ?? token[3]
        : token[0] === "fixed" ? row[token[1]] ?? token[2] : token[1];
};

export const scopeKey = path => JSON.stringify(path.segments ?? JSON.parse(path.key));
const fieldIndexName = field => field === "_sort_name" ? "_sortNameKey" : `_${field}Key`;

export const indexRow = row => {
    const tokens = JSON.parse(row._key);
    const key = tokens.length === 1 ? childKey(row) : tokens.length === 2 ? tokenKey(row, tokens[1]) : undefined;
    if (tokens.length > 1) {
        row._cursorNested = 1;
        row._scope = JSON.stringify(tokens.slice(0, 1));
        if (tokens.length > 2) row._cursorDeep = 1;
    }
    if (key === undefined) return row;
    row._cursorKey = orderedKey(key);
    for (const field of ["created", "timestamp"]) {
        if (Object.hasOwn(row.value ?? {}, field)) {
            const value = orderedValue(row.value[field]);
            if (value) row[`_cursor${field[0].toUpperCase()}${field.slice(1)}`] = value;
            else row[`_cursorUnsupported${field[0].toUpperCase()}${field.slice(1)}`] = 1;
        }
    }
    if (tokens.length === 2 && ["mutual", "mutualrequests"].includes(row._collection)) {
        for (const field of ["id", "uid"]) {
            if (row.value?.[field] === undefined) continue;
            const value = orderedValue(row.value[field]);
            if (value) row[`_scopeIndex${field[0].toUpperCase()}${field.slice(1)}`] = value;
            else row._scopeUnsupportedField = 1;
        }
    }
    if (tokens.length === 1 && row.value && typeof row.value === "object") {
        for (const field of ["to", "name", "email", "_sort_name", "type", "uid"]) {
            if (row.value[field] !== undefined) {
                const value = orderedValue(row.value[field]);
                const property = field === "_sort_name"
                    ? "_indexSortName"
                    : `_index${field[0].toUpperCase()}${field.slice(1)}`;
                if (value) row[property] = value;
                else row._cursorUnsupportedField = 1;
            }
        }
    }
    return row;
};

export const keyInRange = (key, start, end, startDate, endDate) =>
    (start === undefined || compareKeys(key, start) >= 0) &&
    (end === undefined || compareKeys(key, end) <= 0) &&
    (startDate === undefined || compareKeys(key, startDate) >= 0) &&
    (endDate === undefined || compareKeys(key, endDate) <= 0);

/** A short read-only transaction per page; the returned index key is the resume token. */
export async function readIndexedPage(storageKey, collection, field, options, after, size) {
    const {openDatabase} = await import("./helpers");
    const database = await openDatabase(storageKey);
    try {
        const storeName = collection;
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const scoped = options.scope !== undefined;
            const index = store.index(scoped
                ? field === "key"
                    ? "_scopeKey"
                    : field === "created"
                        ? "_scopeCreated"
                        : field === "timestamp" ? "_scopeTimestamp" : `_scope${field[0].toUpperCase()}${field.slice(1)}`
                : field === "key" ? "_cursorKey" : field === "created" ? "_cursorCreated" : fieldIndexName(field));
            const start = field !== "key"
                ? orderedValue(options.start)
                : options.start === undefined
                    ? undefined
                    : orderedKey(options.start);
            const end = field !== "key"
                ? orderedValue(options.end)
                : options.end === undefined
                    ? undefined
                    : orderedKey(options.end);
            const prefix = scoped ? options.scope : collection;
            const lower = start === undefined ? [prefix] : [prefix, start];
            const upper = end === undefined
                ? [prefix, [9]]
                : field !== "key"
                    ? [prefix, end, [2]]
                    : [prefix, end, [9]];
            if (globalThis.indexedDB.cmp(lower, upper) > 0) {
                resolve({rows: [], last: undefined, exhausted: true});
                return;
            }
            if (after !== undefined && (options.order === "desc"
                ? globalThis.indexedDB.cmp(after, lower) <= 0
                : globalThis.indexedDB.cmp(after, upper) >= 0)) {
                resolve({rows: [], last: undefined, exhausted: true});
                return;
            }
            const range = after === undefined
                ? globalThis.IDBKeyRange.bound(lower, upper)
                : options.order === "desc"
                    ? globalThis.IDBKeyRange.bound(lower, after, false, true)
                    : globalThis.IDBKeyRange.bound(after, upper, true, false);
            const rows = [];
            let last;
            let exhausted = true;
            const request = index.openCursor(range, options.order === "desc" ? "prev" : "next");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const tokens = JSON.parse(cursor.value._key);
                const key = scoped ? tokenKey(cursor.value, tokens[1]) : childKey(cursor.value);
                if (keyInRange(key, field !== "key" ? undefined : options.start,
                    field !== "key" ? undefined : options.end, options.startKey, options.endKey)) {
                    rows.push({
                        key,
                        value: cursor.value.value,
                        pathKey: cursor.value._key,
                        indexKey: cursor.key
                    });
                    last = cursor.key;
                }
                if (rows.length >= size) { exhausted = false; return; }
                cursor.continue();
            };
            transaction.oncomplete = () => resolve({rows, last, exhausted});
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { database.close(); }
}

export async function canUseIndex(storageKey, collection, field, scope) {
    const {openDatabase} = await import("./helpers");
    const database = await openDatabase(storageKey);
    try {
        const storeName = collection;
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const scoped = scope !== undefined;
            const keyIndex = scoped ? "_scopeKey" : "_cursorKey";
            const fieldIndex = scoped
                ? `_scope${field[0].toUpperCase()}${field.slice(1)}`
                : field === "created" ? "_cursorCreated" : fieldIndexName(field);
            if (!store.indexNames.contains(keyIndex) ||
                (field !== "key" && !store.indexNames.contains(fieldIndex))) {
                resolve(false);
                return;
            }
            let nested = false; let unsupported = false;
            store.index(scoped ? "_scopeDeep" : "_cursorNested")
                .getKey([scoped ? scope : collection, 1]).onsuccess = event => {
                    nested = event.target.result !== undefined;
                };
            if (field === "created" || (scoped && field === "timestamp")) {
                store.index(scoped ? `_scopeUnsupported${field[0].toUpperCase()}${field.slice(1)}` : "_cursorUnsupportedCreated")
                    .getKey([scoped ? scope : collection, 1]).onsuccess = event => { unsupported = event.target.result !== undefined; };
            } else if (field !== "key") {
                store.index(scoped ? "_scopeUnsupportedField" : "_cursorUnsupportedField")
                    .getKey([scoped ? scope : collection, 1]).onsuccess = event => {
                        unsupported = event.target.result !== undefined;
                    };
            }
            transaction.oncomplete = () => resolve(!nested && !unsupported);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { database.close(); }
}

export const recordPath = (collection, pathKey) => [collection, ...JSON.parse(pathKey).map(token =>
    token[0] === "literal"
        ? token[1]
        : token[0] === "fixed"
            ? {[token[1]]: token[2]}
            : {[token[2]]: token[3], _: token[1]})];
