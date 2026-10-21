import validatePath from "../common/validatePath";
import compareKeys from "../common/compareKeys";
import {fail} from "../../../common";
import {getAllRecords, resolveCollectionPath, subtreeValue} from "./helpers";

const listeners = new Map();
const queues = new Map();
const channels = new Map();
const invalid = message => fail("database/invalid-argument", message);

const pathKeys = path => {
    if (Array.isArray(path) && !path.length) return [];
    if (typeof path === "string") {
        const parts = path.split("/");
        validatePath(parts);
        path = parts.map((key, index) => index ? {key, wildcard: true} : key);
    } else {
        path = resolveCollectionPath(path);
    }
    return path.map(segment => {
        if (segment?.wildcard === true && typeof segment.key === "string" && segment.key) {
            return {key: segment.key, token: undefined};
        }
        if (typeof segment === "string") return {key: segment, token: ["literal", segment]};
        const names = Object.getOwnPropertyNames(segment).filter(name => name !== "_");
        const level = segment._ === true ? 0 : segment._;
        if (Object.hasOwn(segment, "_") && (!Number.isSafeInteger(level) || level < 0)) {
            invalid("Invalid dynamic path level.");
        }
        return {
            key: segment[names[0]],
            token: Object.hasOwn(segment, "_")
                ? ["dynamic", level, names[0], segment[names[0]]]
                : ["fixed", names[0], segment[names[0]]]
        };
    });
};

const related = (left, right) => {
    if (!left.length || !right.length) return true;
    if (left[0].key !== right[0].key) return false;
    const conditions = keys => new Map(keys.slice(1).filter(({token}) => token && token[0] !== "literal")
        .map(({key, token}) => [JSON.stringify(token.slice(0, -1)), key]));
    const first = conditions(left); const second = conditions(right);
    return [...first].every(([name, value]) => !second.has(name) || second.get(name) === value);
};

const channelName = storageKey => `redequate:local:${storageKey}:changes`;
const receive = (storageKey, event) => {
    const paths = event.data?.paths;
    if (!Array.isArray(paths) || !paths.length || !paths.every(path => Array.isArray(path) &&
        path.length && path.every(segment => segment && typeof segment.key === "string" &&
            (segment.token === undefined || Array.isArray(segment.token))))) return;
    enqueue(storageKey, async () => {
        for (const listener of listeners.get(storageKey) ?? []) {
            if (paths.some(path => related(listener.keys, path))) await refresh(listener);
        }
    }).catch(() => {});
};

const openChannel = storageKey => {
    if (channels.has(storageKey) || typeof globalThis.BroadcastChannel !== "function") return;
    try {
        const channel = new globalThis.BroadcastChannel(channelName(storageKey));
        channel.onmessage = event => receive(storageKey, event);
        channels.set(storageKey, channel);
    } catch (_) { /* BroadcastChannel is optional (for example in SSR). */ }
};

const publish = (storageKey, paths) => {
    if (!paths.length || typeof globalThis.BroadcastChannel !== "function") return;
    if (listeners.has(storageKey)) openChannel(storageKey);
    let channel = channels.get(storageKey);
    let temporary = false;
    try {
        if (!channel) {
            channel = new globalThis.BroadcastChannel(channelName(storageKey));
            temporary = true;
        }
        channel.postMessage({paths});
    } catch (_) { /* A notification failure must not turn a committed write into a failed write. */ } finally { if (temporary) channel?.close(); }
};

const enqueue = (storageKey, operation) => {
    const next = (queues.get(storageKey) ?? Promise.resolve()).then(operation);
    queues.set(storageKey, next.catch(() => {}));
    return next;
};

const setValue = (root, keys, value) => {
    let node = root;
    for (const key of keys.slice(0, -1)) {
        if (!Object.hasOwn(node, key) || node[key] === null || typeof node[key] !== "object" || Array.isArray(node[key])) {
            Object.defineProperty(node, key, {value: {}, enumerable: true, configurable: true, writable: true});
        }
        node = node[key];
    }
    Object.defineProperty(node, keys.at(-1), {value, enumerable: true, configurable: true, writable: true});
};

const snapshot = async (storageKey, keys, path) => {
    const rows = await getAllRecords(storageKey);
    if (Array.isArray(path)) return subtreeValue(rows, path);
    const root = {};
    rows.sort((a, b) => JSON.parse(a._key).length - JSON.parse(b._key).length);
    for (const row of rows) {
        if (row._collection !== keys[0].key) continue;
        const segments = JSON.parse(row._key);
        const path = keys.slice(1).map(({token}) => token);
        const shared = Math.min(path.length, segments.length);
        if (!path.slice(0, shared).every((token, index) => token === undefined
            ? keys[index + 1].key === segments[index].at(-1)
            : equal(token, segments[index]))) continue;
        const address = [row._collection, ...segments.map(segment => segment.at(-1))];
        setValue(root, address, row.value);
    }
    let value = root;
    for (const {key} of keys) {
        if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
        value = value[key];
    }
    return value;
};

const children = value => value !== null && typeof value === "object" ? value : {};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const maximumKey = value => Object.keys(children(value)).sort(compareKeys).at(-1);

const deliver = (listener, value) => {
    if (!listener.active) return;
    const {callbacks, initial, previous} = listener;
    listener.previous = structuredClone(value);
    listener.initial = false;
    const before = children(previous); const after = children(value);
    if (initial) listener.initialKey = maximumKey(value);
    if (!initial) {
        for (const key of Object.keys(before)) {
            if (!Object.hasOwn(after, key)) callbacks.onChildRemove?.({key, value: before[key]});
        }
    }
    if (!initial) {
        for (const key of Object.keys(after).sort(compareKeys)) {
            if (!Object.hasOwn(before, key) && (listener.initialKey === undefined || compareKeys(key, listener.initialKey) > 0)) {
                callbacks.onChildAdd?.({key, value: after[key]});
            }
        }
    }
    if (!initial) {
        for (const key of Object.keys(after)) {
            if (Object.hasOwn(before, key) && !equal(before[key], after[key])) {
                callbacks.onChildChange?.({key, value: after[key]});
            }
        }
    }
    if (initial || !equal(previous, value)) callbacks.onChange?.(value);
};

const refresh = async listener => {
    if (!listener.active) return;
    let value;
    try {
        value = listener.read
            ? await listener.read()
            : await snapshot(listener.storageKey, listener.keys, listener.path);
    } catch (error) {
        try { listener.callbacks.onError(error); } catch (_) { /* Already reported by DatabaseBase. */ }
        return;
    }
    try { deliver(listener, value); } catch (_) { /* Callback wrapper already reported the error. */ }
};

export const mutate = (storageKey, paths, operation) => enqueue(storageKey, async () => {
    const result = await operation();
    const changed = paths.map(pathKeys);
    for (const listener of listeners.get(storageKey) ?? []) {
        if (changed.some(path => related(listener.keys, path))) await refresh(listener);
    }
    publish(storageKey, changed);
    return result;
});

export default function addEventListener(storageKey, path, callbacks, read) {
    for (const [name, handler] of Object.entries(callbacks)) {
        if (name.startsWith("on") && handler !== undefined && !(handler instanceof Function)) {
            invalid(`${name} must be a function or undefined.`);
        }
    }
    if (callbacks.orderBy !== undefined) {
        validatePath(callbacks.orderBy);
        const path = typeof callbacks.orderBy === "string"
            ? callbacks.orderBy === "" ? [] : [callbacks.orderBy]
            : callbacks.orderBy;
        const orderBy = path.map(segment => typeof segment === "string"
            ? segment
            : segment[Object.getOwnPropertyNames(segment).find(name => name !== "_")]);
        callbacks = {...callbacks, orderBy};
    }
    const keys = pathKeys(path);
    const listener = {storageKey, keys, path, callbacks, read, active: true, initial: true, previous: undefined};
    if (!listeners.has(storageKey)) listeners.set(storageKey, new Set());
    listeners.get(storageKey).add(listener);
    openChannel(storageKey);
    enqueue(storageKey, () => refresh(listener)).catch(() => {});
    return {
        remove: () => {
            if (!listener.active) return;
            listener.active = false;
            const subscribers = listeners.get(storageKey);
            subscribers.delete(listener);
            if (!subscribers.size) {
                listeners.delete(storageKey);
                channels.get(storageKey)?.close();
                channels.delete(storageKey);
            }
        }
    };
}
