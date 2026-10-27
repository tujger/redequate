import {observeWrites} from "../../../backend/src/local/database/createHelpers";
import validatePath from "../common/validatePath";
import compareKeys from "../common/compareKeys";
import {fail} from "../../../common";
import {assertCollection, getSubtree, readValue, resolveCollectionPath} from "./helpers";

const listeners = new Map();
const queues = new Map();
const channels = new Map();
const writeSubscriptions = new Map();
const storageName = context => typeof context === "string" ? context : context.storageId;
const invalid = message => fail("database/invalid-argument", message);

const collectionFor = path => path === "" || Array.isArray(path) && !path.length
    ? undefined : resolveCollectionPath(path)[0];

const channelName = storageId => `redequate:local:${storageId}:changes`;
const receive = (storageId, event) => {
    const collections = event.data?.collections;
    if (!Array.isArray(collections) || !collections.every(name => typeof name === "string")) return;
    enqueue(storageId, async () => {
        for (const listener of listeners.get(storageName(storageId)) ?? []) {
            if (!listener.collection || collections.includes(listener.collection)) await refresh(listener);
        }
    }).catch(() => {});
};

const openChannel = storageId => {
    if (channels.has(storageId) || typeof globalThis.BroadcastChannel !== "function") return;
    try {
        const channel = new globalThis.BroadcastChannel(channelName(storageId));
        channel.onmessage = event => receive(storageId, event);
        channels.set(storageId, channel);
    } catch (_) { /* BroadcastChannel is optional (for example in SSR). */ }
};

const publish = (storageId, collections) => {
    if (!collections.length || typeof globalThis.BroadcastChannel !== "function") return;
    if (listeners.has(storageId)) openChannel(storageId);
    let channel = channels.get(storageId);
    let temporary = false;
    try {
        if (!channel) {
            channel = new globalThis.BroadcastChannel(channelName(storageId));
            temporary = true;
        }
        channel.postMessage({collections});
    } catch (_) { /* A notification failure must not turn a committed write into a failed write. */ } finally { if (temporary) channel?.close(); }
};

const enqueue = (storageId, operation) => {
    storageId = storageName(storageId);
    const next = (queues.get(storageId) ?? Promise.resolve()).then(operation);
    queues.set(storageId, next.catch(() => {}));
    return next;
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
            : await getSubtree(listener.storageId, listener.path);
    } catch (error) {
        try { listener.callbacks.onError(error); } catch (_) { /* Already reported by DatabaseBase. */ }
        return;
    }
    try { deliver(listener, value); } catch (_) { /* Callback wrapper already reported the error. */ }
};

export const mutate = (storageId, paths, operation) => enqueue(storageId, async () => {
    const result = await operation();
    const changed = [...new Set(paths.map(collectionFor).filter(Boolean))];
    for (const listener of listeners.get(storageName(storageId)) ?? []) {
        if (!listener.collection || changed.includes(listener.collection)) await refresh(listener);
    }
    publish(storageName(storageId), changed);
    return result;
});

export default function addEventListener(storageId, path, callbacks, read) {
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
    if (read === undefined && collectionFor(path)) read = readValue.bind(null, storageId, path, {orderBy: callbacks.orderBy});
    const collection = collectionFor(path);
    if (collection) assertCollection(storageId, collection);
    const listener = {storageId, collection, path, callbacks, read, active: true, initial: true, previous: undefined};
    storageId = storageName(storageId);
    if (!listeners.has(storageId)) {
        listeners.set(storageId, new Set());
        writeSubscriptions.set(storageId, observeWrites(storageId, collection => enqueue(storageId, async () => {
            for (const listener of listeners.get(storageId) ?? []) {
                if (!listener.collection || listener.collection === collection) await refresh(listener);
            }
        })));
    }
    listeners.get(storageId).add(listener);
    openChannel(storageId);
    enqueue(storageId, () => refresh(listener)).catch(() => {});
    return {
        remove: () => {
            if (!listener.active) return;
            listener.active = false;
            const subscribers = listeners.get(storageId);
            subscribers.delete(listener);
            if (!subscribers.size) {
                listeners.delete(storageId);
                writeSubscriptions.get(storageId)?.();
                writeSubscriptions.delete(storageId);
                channels.get(storageId)?.close();
                channels.delete(storageId);
            }
        }
    };
}
