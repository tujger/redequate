import {observeWrites} from "../../../backend/src/local/database/callable/createHelpers";
import validatePath from "../common/validatePath";
import compareKeys from "../common/compareKeys";
import {fail} from "../../../common";
import {assertCollection, getSubtree, readValue, validateCollectionPath} from "./helpers";

const listeners = new Map();
const queues = new Map();
const channels = new Map();
const writeSubscriptions = new Map();
const storageName = context => typeof context === "string" ? context : context.storageId;
const invalid = message => fail("database/invalid-argument", message);

const collectionFor = path => path === "" || Array.isArray(path) && !path.length
    ? undefined : validateCollectionPath(path)[0];

const channelName = storageId => `redequate:local:${storageId}:changes`;
const receive = (storageId, event) => {
    const collections = event.data?.collections;
    if (!Array.isArray(collections) || !collections.every(name => typeof name === "string")) return;
    enqueue(storageId, async () => {
        for (const listener of listeners.get(storageName(storageId)) ?? []) {
            if (!listener.collection || collections.includes(listener.collection)) await refresh(listener);
        }
    });
};

const openChannel = storageId => {
    if (channels.has(storageId) || typeof globalThis.BroadcastChannel !== "function") return;
    try {
        const channel = new globalThis.BroadcastChannel(channelName(storageId));
        channel.onmessage = event => receive(storageId, event);
        channels.set(storageId, channel);
    } catch (_) { /* BroadcastChannel is optional (for example in SSR). */ }
};

const reportAsyncError = error => {
    if (typeof globalThis.reportError === "function") globalThis.reportError(error);
    else queueMicrotask(() => { throw error; });
};

const enqueue = (storageId, operation) => {
    storageId = storageName(storageId);
    const next = (queues.get(storageId) ?? Promise.resolve()).then(operation);
    const tail = next.catch(reportAsyncError).finally(() => {
        if (queues.get(storageId) === tail) queues.delete(storageId);
    });
    queues.set(storageId, tail);
    return tail;
};

// Callbacks may write through the same queue; observe rejections without awaiting them.
const invokeCallback = (callback, value) => {
    const result = callback?.(value);
    if (result?.then instanceof Function) Promise.resolve(result).catch(reportAsyncError);
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
            if (!Object.hasOwn(after, key)) invokeCallback(callbacks.onChildRemove, {key, value: before[key]});
        }
    }
    if (!initial) {
        for (const key of Object.keys(after).sort(compareKeys)) {
            if (!Object.hasOwn(before, key) && (listener.initialKey === undefined || compareKeys(key, listener.initialKey) > 0)) {
                invokeCallback(callbacks.onChildAdd, {key, value: after[key]});
            }
        }
    }
    if (!initial) {
        for (const key of Object.keys(after)) {
            if (Object.hasOwn(before, key) && !equal(before[key], after[key])) {
                invokeCallback(callbacks.onChildChange, {key, value: after[key]});
            }
        }
    }
    if (initial || !equal(previous, value)) invokeCallback(callbacks.onChange, value);
};

const refresh = async listener => {
    if (!listener.active) return;
    try {
        let value;
        try {
            value = listener.read
                ? await listener.read()
                : await getSubtree(listener.storageId, listener.path);
        } catch (error) {
            if (!listener.callbacks.onError) throw error;
            invokeCallback(listener.callbacks.onError, error);
            return;
        }
        deliver(listener, value);
    } catch (error) {
        reportAsyncError(error);
    }
};

export default function addEventListener(storageId, path, callbacks, read) {
    validatePath(path);
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
    enqueue(storageId, () => refresh(listener));
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
