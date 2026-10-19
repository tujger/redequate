import {DatabaseCursor} from "../common/DatabaseCursor";
import normalizePath from "../common/normalizePath";
import createCursorQuery from "./createCursorQuery";

export default class FirebaseCursor extends DatabaseCursor {
    #state;
    #header = [];

    constructor(firebase, path, options = {}) {
        super(options, path);
        const query = createCursorQuery(firebase, path, this);
        const cursor = this;
        this.#state = {
            ...query,
            path,
            entryPath: normalizePath(path),
            options: this,
            get count() { return cursor._count; },
            set count(value) { cursor._count = value; },
            get position() { return cursor._position; },
            set position(value) { cursor._position = value; },
            byKey: query.orderBy === undefined && !query.byValue,
            scanKey: undefined,
            scanValue: undefined,
            buffer: [],
            offset: 0,
            exhausted: false
        };
    }

    async next(n = 1) {
        const position = this.position;
        const heading = await super.next(n);
        this.#header.push(...heading);
        this._count -= heading.length;
        this._position = position;
        const entries = await next(this.#state, n);
        const headers = this.#header.splice(0);
        this._count += headers.length;
        this._position = Object.freeze({...this.position,
            index: this.position.index + headers.length,
            key: entries.length ? this.position.key : headers.length ? headers[headers.length - 1].key : this.position.key});
        return [...headers, ...entries];
    }

    subscribe(listener) {
        super.subscribe(listener);
        return subscribe(this.#state, listener);
    }
}

async function readPage(state, key, value, size) {
    const {initialQuery, continuationQuery, ascending, byKey} = state;
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
    const snapshot = await query.once("value");
    const children = [];
    snapshot.forEach(child => {
        if (child.key !== key) {
            children.push(child);
        }
    });
    if (!ascending) {
        children.reverse();
    }
    return children;
}

async function handleEntry(state, child) {
    const {handle} = state.options;
    const entry = {path: state.entryPath, key: child.key, value: child.val()};
    if (!handle) {
        return entry;
    }
    // A handler may mutate its input without requesting a write.
    const replacement = await handle(structuredClone(entry));
    if (replacement === undefined) {
        return entry;
    }
    await child.ref.set(replacement);
    if (replacement === null) {
        return undefined;
    }
    const saved = await child.ref.once("value");
    if (!saved.exists()) {
        return undefined;
    }
    return {path: state.entryPath, key: child.key, value: saved.val()};
}

function subscribe(state, notify, onError = state.options.onError) {
    const {path, initialQuery, startKey, endKey} = state;
    let active = true;
    let initialized = false;
    let failed = false;
    const report = error => {
        if (active && !failed) {
            failed = true;
            onError(error, "cursor.subscribe", {path});
        }
    };
    const callbacks = [["child_added", "add"], ["child_changed", "change"], ["child_removed", "remove"]]
        .map(([event, type]) => [event, child => {
            if (active && initialized
                && (startKey === undefined || child.key >= startKey)
                && (endKey === undefined || child.key <= endKey)) {
                state.count += type === "add" ? 1 : type === "remove" ? -1 : 0;
                notify({type, entry: {path: state.entryPath, key: child.key, value: child.val()}});
            }
        }]);
    const unsubscribe = () => {
        active = false;
        for (const [event, callback] of callbacks) {
            initialQuery.off(event, callback);
        }
    };
    try {
        for (const [event, callback] of callbacks) {
            initialQuery.on(event, callback, report);
        }
        initialQuery.once("value").then(() => { initialized = true; }, report);
    } catch (error) {
        unsubscribe();
        throw error;
    }
    return {unsubscribe};
}

async function next(state, n = 1) {
    const {byKey, byValue, orderBy, startKey, endKey} = state;
    if (state.position.finished) {
        return [];
    }

    const entries = [];
    while (entries.length < n) {
        if (state.offset === state.buffer.length) {
            if (state.exhausted) {
                break;
            }
            const size = n - entries.length;
            state.buffer = await readPage(state, state.scanKey, state.scanValue, size);
            state.offset = 0;
            state.exhausted = state.buffer.length < size;
            if (!state.buffer.length) {
                break;
            }
        }
        const child = state.buffer[state.offset];
        const sortValue = byKey ? child.key : byValue ? child.val() : child.child(orderBy).val();
        if ((startKey !== undefined && child.key < startKey) || (endKey !== undefined && child.key > endKey)) {
            state.scanKey = child.key;
            state.scanValue = sortValue;
            state.offset++;
            continue;
        }
        const entry = await handleEntry(state, child);
        state.scanKey = child.key;
        state.scanValue = sortValue;
        state.offset++;
        if (entry === undefined) {
            continue;
        }
        state.position = Object.freeze({index: state.position.index + 1, key: entry.key, finished: false});
        entries.push(entry);
    }
    if (state.exhausted && state.offset === state.buffer.length) {
        state.position = Object.freeze({...state.position, finished: true});
        state.buffer = [];
        state.offset = 0;
    }
    state.count += entries.length;
    return entries;
}
