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
        const entries = await readEntries(state, this.handle, n);
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

async function readEntries(state, handle, n) {
    const {byValue, orderBy, startKey, endKey} = state;
    const byKey = orderBy === undefined && !byValue;
    const entries = [];
    while (entries.length < n) {
        if (state.offset === state.buffer.length) {
            if (state.exhausted) break;
            const size = n - entries.length;
            state.buffer = await readPage(state, state.scanKey, state.scanValue, size);
            state.offset = 0;
            state.exhausted = state.buffer.length < size;
            if (!state.buffer.length) break;
        }
        const child = state.buffer[state.offset];
        // Capture the ordered value before handle can replace or delete it.
        const sortValue = byKey ? child.key : byValue ? child.val() : child.child(orderBy).val();
        const inRange = (startKey === undefined || child.key >= startKey)
            && (endKey === undefined || child.key <= endKey);
        const entry = inRange ? await handleEntry(handle, child) : undefined;
        state.scanKey = child.key;
        state.scanValue = sortValue;
        state.offset++;
        if (entry !== undefined) entries.push(entry);
    }
    return entries;
}

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

function detachCallbacks(query, callbacks) {
    let failure;
    for (const [event, callback] of callbacks) {
        try { query.off(event, callback); }
        catch (error) { failure ??= {error}; }
    }
    if (failure) throw failure.error;
}

async function readPage(state, key, value, size) {
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

async function handleEntry(handle, child) {
    const entry = {key: child.key, value: child.val()};
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
    return {key: child.key, value: saved.val()};
}
