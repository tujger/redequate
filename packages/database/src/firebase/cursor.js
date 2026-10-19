import {DatabaseCursor} from "../common/DatabaseCursor";
import createCursorQuery from "./createCursorQuery";

export default class FirebaseCursor extends DatabaseCursor {
    #state;
    #header = [];

    constructor(firebase, path, options = {}) {
        super(options, path);
        this.#state = {
            ...createCursorQuery(firebase, path, this),
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

    subscribe(listener) {
        super.subscribe(listener);
        return subscribeEntries(this.#state, event => {
            this._started = true;
            this._count += event.type === "add" ? 1 : event.type === "remove" ? -1 : 0;
            return listener(event);
        }, error => this.onError(error, "cursor.subscribe", {path: this.path}));
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
    const inRange = (startKey === undefined || child.key >= startKey)
        && (endKey === undefined || child.key <= endKey);
    return {...props, child, sortValue, entry: inRange ? {key: child.key, value: child.val()} : undefined,
        replacement: undefined};
};

const advanceScan = (props) => {
    const {state, child, sortValue, entry, entries} = props;
    state.scanKey = child.key;
    state.scanValue = sortValue;
    state.offset++;
    if (entry !== undefined) entries.push(entry);
    return {...props, state, entries};
};

function subscribeEntries(state, notify, onError) {
    const {initialQuery, startKey, endKey} = state;
    let active = true, initialized = false, failed = false, registering = true;
    const report = error => {
        if (active && !failed) {
            failed = true;
            // Registration errors go through the composition's existing boundary.
            if (registering) throw error;
            onError(error);
        }
    };
    const callbacks = [["child_added", "add"], ["child_changed", "change"], ["child_removed", "remove"]]
        .map(([event, type]) => [event, child => {
            if (active && initialized
                && (startKey === undefined || child.key >= startKey)
                && (endKey === undefined || child.key <= endKey)) {
                return notify({type, entry: {key: child.key, value: child.val()}});
            }
        }]);
    const unsubscribe = () => {
        if (!active) return;
        active = false;
        detachCallbacks(initialQuery, callbacks);
    };
    try {
        for (const [event, callback] of callbacks) initialQuery.on(event, callback, report);
        initialQuery.once("value").then(() => { initialized = true; }, report);
        registering = false;
    } catch (error) {
        unsubscribe();
        throw error;
    }
    return {unsubscribe};
}

const detachCallbacks = (query, callbacks) => {
    let failure;
    for (const [event, callback] of callbacks) {
        try { query.off(event, callback); }
        catch (error) { failure ??= {error}; }
    }
    if (failure) throw failure.error;
};

async function readPage(props) {
    props = preparePageQuery(props);
    props = await fetchPage(props);
    return extractChildren(props);
}

const preparePageQuery = (props) => {
    const {state, key, value, size} = props;
    const {initialQuery, continuationQuery, ascending, orderBy, byValue} = state;
    const byKey = orderBy === undefined && !byValue;
    let query = key === undefined ? initialQuery : continuationQuery;
    if (key !== undefined) {
        if (ascending) {
            query = byKey ? query.startAt(key) : query.startAt(value, key);
        } else {
            query = byKey ? query.endAt(key) : query.endAt(value, key);
        }
    }
    const limit = key === undefined ? size : size + 1;
    query = ascending ? query.limitToFirst(limit) : query.limitToLast(limit);
    return {...props, query};
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
    const {child, replacement} = props;
    if (replacement === undefined) return props;
    await child.ref.set(replacement);
    return {...props, entry: undefined};
};

const rereadEntry = async (props) => {
    const {child, replacement} = props;
    if (replacement === undefined || replacement === null) return props;
    const saved = await child.ref.once("value");
    return {...props, entry: saved.exists() ? {key: child.key, value: saved.val()} : undefined};
};
