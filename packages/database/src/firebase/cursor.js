import {fail} from "../../../common";
import {composeCursor} from "../common/cursor";
import createCursorQuery from "./createCursorQuery";

export default function cursor(firebase, path, options, identity, run) {
    const queries = path instanceof Array && path.some(part => typeof part === "object")
        ? path : [{path}];

    const result = composeCursor(queries, options, createCursor.bind(null, firebase), run, path, identity);

    if (result === undefined) {
        return undefined;
    }
    return Object.defineProperty(result, "id", {
        value: identity.id,
        enumerable: true
    });
}

function createCursor(firebase, path, options = {}, tracking = {}) {
    if (options === null || typeof options !== "object" || options instanceof Array) {
        fail("database/invalid-argument", "options must be an object.");
    }
    if (options.handle !== undefined && !(options.handle instanceof Function)) {
        fail("database/invalid-argument", "handle must be a function or undefined.");
    }
    const query = createCursorQuery(firebase, path, options);
    const state = {
        ...query,
        path,
        options,
        tracking,
        count: 0,
        byKey: query.orderBy === undefined && !query.byValue,
        position: Object.freeze({index: -1, key: undefined, finished: false}),
        scanKey: undefined,
        scanValue: undefined,
        buffer: [],
        offset: 0,
        exhausted: false
    };
    return {
        subscribe: subscribe.bind(null, state),
        get count() {
            return state.count;
        },
        get position() {
            return state.position;
        },
        next: next.bind(null, state)
    };
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
                notify({type, entry: {key: child.key, value: child.val()}});
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
    const {tracking, byKey, byValue, orderBy, startKey, endKey} = state;
    if (!Number.isSafeInteger(n) || n <= 0) {
        fail("database/invalid-argument", "n must be a positive safe integer.");
    }
    if (state.position.finished) {
        return [];
    }

    const entries = [];
    while (entries.length < n) {
        if (state.offset === state.buffer.length) {
            if (state.exhausted) {
                break;
            }
            const size = tracking.readSize?.() ?? n - entries.length;
            state.buffer = await readPage(state, state.scanKey, state.scanValue, size);
            state.offset = 0;
            state.exhausted = state.buffer.length < size;
            if (!state.buffer.length) {
                break;
            }
        }
        const child = state.buffer[state.offset];
        const sortValue = byKey ? child.key : byValue ? child.val() : child.child(orderBy).val();
        if ((startKey !== undefined && child.key < startKey) || (endKey !== undefined && child.key > endKey)
            || tracking.accept?.(child.key) === false) {
            state.scanKey = child.key;
            state.scanValue = sortValue;
            state.offset++;
            continue;
        }
        const entry = await handleEntry(state, child);
        tracking.processed?.(child.key);
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
