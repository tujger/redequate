import {setImmediate} from "node:timers";
import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import {openLocalDatabase} from "../../../../common/src/localDatabase";

export const installIndexedDB = () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const channels = new Set();
    vi.stubGlobal("BroadcastChannel", class {
        constructor(name) { this.name = name; channels.add(this); }
        postMessage(data) {
            for (const peer of channels) {
                if (peer !== this && peer.name === this.name) queueMicrotask(() => {
                    if (channels.has(peer)) peer.onmessage?.({data: structuredClone(data)});
                });
            }
        }
        close() { channels.delete(this); }
    });
};

// Drain fake-indexeddb's real task queue without advancing the simulated clock.
export const flushIndexedDB = async () => {
    for (let i = 0; i < 60; i++) await new Promise(resolve => setImmediate(resolve));
};

export const rawRecord = async (store, value) => {
    const database = await openLocalDatabase();
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(store, "readwrite");
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
            transaction.objectStore(store).put(value);
        });
    } finally { database.close(); }
};
