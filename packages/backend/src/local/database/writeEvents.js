import {identifier} from "../../../../common";

const source = identifier();
const subscriptions = new Map();

const equal = (a, b) => {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
};

export const subscribeWrites = (storageId, id, subscriber) => {
    let state = subscriptions.get(storageId);
    if (!state) {
        state = {subscribers: new Map()};
        subscriptions.set(storageId, state);
    }
    if (state.subscribers.has(id)) return () => {
    };
    state.subscribers.set(id, subscriber);
    return () => {
        state.subscribers.delete(id);
        if (!state.subscribers.size) {
            subscriptions.delete(storageId);
        }
    };
};

export const captureWrites = async (storageId, transaction) => {
    const snapshots = new Map();
    for (const [id, subscriber] of subscriptions.get(storageId)?.subscribers ?? []) {
        if (transaction.objectStoreNames.contains(subscriber.collection)) {
            snapshots.set(id, await subscriber.snapshot(transaction));
        }
    }
    return snapshots;
};

export const publishWrites = (storageId, previous, value) => {
    const state = subscriptions.get(storageId);
    if (!state) return;
    const changes = [];
    for (const [id, before] of previous) {
        const after = value.get(id) ?? new Map();
        for (const key of new Set([...before.keys(), ...after.keys()])) {
            const oldEntry = before.get(key), newEntry = after.get(key);
            const previousValue = oldEntry?.value ?? null, nextValue = newEntry?.value ?? null;
            if (!equal(previousValue, nextValue)) changes.push({
                subscription: id, path: (newEntry ?? oldEntry).path,
                params: (newEntry ?? oldEntry).params, previous: previousValue, value: nextValue,
            });
        }
    }
    if (!changes.length) return;
    const message = {source, changes};
    let channel;
    try {
        if (typeof globalThis.BroadcastChannel === "function") {
            channel = new globalThis.BroadcastChannel(`redequate:local:${storageId}:changes`);
            channel.postMessage(message);
        }
    } catch (_) { /* A transport failure does not invalidate committed data. */
    } finally {
        channel?.close();
    }
    // BroadcastChannel does not deliver to its sender. Schedule its local delivery explicitly.
    queueMicrotask(() => {
        for (const change of message.changes) {
            const subscriber = state.subscribers.get(change.subscription);
            if (!subscriber) continue;
            try {
                const result = subscriber.deliver(structuredClone(change));
                // A reaction may await another write; never hold delivery on that promise.
                if (result?.then instanceof Function) Promise.resolve(result).catch(console.error);
            } catch (error) {
                console.error(error);
            }
        }
    });
};
