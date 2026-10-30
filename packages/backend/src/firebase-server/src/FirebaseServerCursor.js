import {key} from "firebase-key";
import DatabaseCursor from "../../../../database/src/common/DatabaseCursor.ts";
import {DatabaseOrder} from "../../../../database/src/common/DatabaseOrder.ts";
import compareValues from "../../../../database/src/common/compareValues.js";
import compareKeys from "../../../../database/src/common/compareKeys.js";
import update from "../../../../database/src/common/methods/update.js";
import parsePath from "../../../../database/src/firebase/parsePath.ts";

export default class FirebaseServerCursor extends DatabaseCursor {
    #state;
    #header = [];

    constructor(database, path, options = {}, backend) {
        const {effectivePath: resolvedPath, address} = parsePath(path, "collection");
        super(options, address);
        this.#state = {
            ...createCursorQuery(database, resolvedPath, this),
            backend,
            path: this.path,
            scanKey: undefined,
            scanValue: undefined,
            buffer: [],
            offset: 0,
            exhausted: false
        };
    }

    async next(n = 1) {
        this.#header.push(...await super.next(n));
        if (this.position.finished) return [];
        const state = this.#state;
        const {entries} = await readEntries({state, handle: this.handle, n, entries: []});
        const result = [...this.#header.splice(0), ...entries];
        this._position = Object.freeze({
            index: this.position.index + result.length,
            key: result.length ? result[result.length - 1].key : this.position.key,
            finished: state.exhausted && state.offset === state.buffer.length
        });
        this._count += result.length;
        if (this.position.finished) {
            state.buffer = [];
            state.offset = 0;
        }
        return result;
    }
}

async function readEntries(props) {
    const {state, n, entries} = props;
    while (entries.length < n) {
        props = await fillBuffer(props);
        if (state.offset === state.buffer.length) break;
        props = prepareCandidate(props);
        props = await handleEntry(props);
        props = advanceScan(props);
    }
    return {...props, state, entries};
}

const fillBuffer = async (props) => {
    const {state, n, entries} = props;
    if (state.offset < state.buffer.length || state.exhausted) return props;
    const page = await readPage({...props, key: state.scanKey, value: state.scanValue, size: n - entries.length});
    state.buffer = page.children;
    state.offset = 0;
    state.exhausted = page.children.length < page.size;
    return {...props, state};
};

const prepareCandidate = (props) => {
    const {state} = props;
    const {byValue, orderBy, startKey, endKey} = state;
    const child = state.buffer[state.offset];
    const byKey = orderBy === undefined && !byValue;
    // Capture the ordered value before handle can replace or delete it.
    const sortValue = byKey ? child.key : byValue ? child.val() : child.child(orderBy).val();
    const inRange = (startKey === undefined || child.key >= startKey) &&
        (endKey === undefined || child.key <= endKey);
    return {
        ...props,
        child,
        sortValue,
        entry: inRange && hasOrderedField(child, orderBy) ? {key: child.key, value: child.val()} : undefined,
        replacement: undefined
    };
};

const hasOrderedField = (snapshot, orderBy) => !orderBy || snapshot.child(orderBy).exists();

const advanceScan = (props) => {
    const {state, child, sortValue, entry, entries} = props;
    state.scanKey = child.key;
    state.scanValue = sortValue;
    state.offset++;
    if (entry !== undefined) entries.push(entry);
    return {...props, state, entries};
};

async function readPage(props) {
    const {state, value, key, size} = props;
    // RTDB accepts object values in results but rejects them as query endpoints.
    // Once the boundary is an object, use the original query and filter its tuple.
    if (value !== null && typeof value === "object") {
        const snapshot = await state.initialQuery.once("value");
        const children = [];
        snapshot.forEach(child => {
            const sort = state.byValue ? child.val() : child.child(state.orderBy).val();
            const comparison = compareValues(sort, value) || compareKeys(child.key, key);
            if (state.ascending ? comparison > 0 : comparison < 0) children.push(child);
        });
        if (!state.ascending) children.reverse();
        return {...props, children: children.slice(0, size)};
    }
    props = preparePageQuery(props);
    props = await fetchPage(props);
    return extractChildren(props);
}

const preparePageQuery = (props) => {
    const {state, key, value, size} = props;
    const {initialQuery, continuationQuery, ascending, orderBy, byValue} = state;
    const byKey = orderBy === undefined && !byValue;
    let selection = key === undefined ? initialQuery : continuationQuery;
    if (key !== undefined) {
        if (ascending) {
            selection = byKey ? selection.startAt(key) : selection.startAt(value, key);
        } else {
            selection = byKey ? selection.endAt(key) : selection.endAt(value, key);
        }
    }
    const limit = key === undefined ? size : size + 1;
    selection = ascending ? selection.limitToFirst(limit) : selection.limitToLast(limit);
    return {...props, query: selection};
};

const fetchPage = async (props) => {
    const {query} = props;
    return {...props, snapshot: await query.once("value")};
};

const extractChildren = (props) => {
    const {state, snapshot, key} = props;
    const children = [];
    snapshot.forEach(child => {
        if (child.key !== key) children.push(child);
    });
    if (!state.ascending) children.reverse();
    return {...props, children};
};

async function handleEntry(props) {
    props = await invokeHandle(props);
    props = await saveReplacement(props);
    return rereadEntry(props);
}

const invokeHandle = async (props) => {
    const {handle, entry} = props;
    if (!handle || entry === undefined) return props;
    // A handler may mutate its input without requesting a write.
    return {...props, replacement: await handle(structuredClone(entry))};
};

const saveReplacement = async (props) => {
    const {state, child, replacement} = props;
    if (replacement === undefined) return props;
    const path = state.path ? `${state.path}/${child.key}` : child.key;
    await update(state.backend, path, () => replacement);
    return {...props, entry: undefined};
};

const rereadEntry = async (props) => {
    const {child, replacement} = props;
    if (replacement === undefined || replacement === null) return props;
    const saved = await child.ref.once("value");
    return {...props, entry: saved.exists() && hasOrderedField(saved, props.state.orderBy) ? {key: child.key, value: saved.val()} : undefined};
};

function createCursorQuery(database, path, {
    orderBy,
    equalTo: equals,
    start,
    end,
    startDate,
    endDate,
    order = DatabaseOrder.ASC
}) {
    orderBy = orderBy === undefined ? undefined : parsePath(orderBy).address;
    const startKey = startDate === undefined ? undefined : key(startDate, "min");
    const endKey = endDate === undefined ? undefined : key(endDate, "max");
    if (typeof start === "string" && end === undefined) {
        end = start + "\uf8ff";
    }
    if (orderBy === undefined && equals === undefined) {
        // Explicit key bounds remain in the query; date bounds also filter the scan.
        if (start === undefined) {
            start = startKey;
        }
        if (end === undefined) {
            end = endKey;
        }
    }
    const reference = database.ref(parsePath(path).address);
    const byValue = orderBy === "" || orderBy === undefined && equals !== undefined;
    let baseQuery;
    if (orderBy !== undefined && orderBy !== "") {
        baseQuery = reference.orderByChild(orderBy);
    } else if (byValue) {
        baseQuery = reference.orderByValue();
    } else {
        baseQuery = reference.orderByKey();
    }
    const ascending = order === DatabaseOrder.ASC;
    let initialQuery = baseQuery;
    let continuationQuery = baseQuery;
    if (equals !== undefined) {
        initialQuery = baseQuery.equalTo(equals);
        continuationQuery = ascending ? baseQuery.endAt(equals) : baseQuery.startAt(equals);
    } else {
        if (start !== undefined) {
            initialQuery = initialQuery.startAt(start);
        }
        if (end !== undefined) {
            initialQuery = initialQuery.endAt(end);
        }
        if (ascending && end !== undefined) {
            continuationQuery = continuationQuery.endAt(end);
        }
        if (!ascending && start !== undefined) {
            continuationQuery = continuationQuery.startAt(start);
        }
    }
    return {initialQuery, continuationQuery, ascending, orderBy, byValue, startKey, endKey};
}
