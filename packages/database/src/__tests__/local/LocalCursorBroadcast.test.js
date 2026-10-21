import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";

class Channel {
    static open = new Set();
    static messages = [];
    constructor(name) { this.name = name; Channel.open.add(this); }
    postMessage(data) {
        Channel.messages.push({name: this.name, data});
        for (const peer of Channel.open) {
            if (peer !== this && peer.name === this.name) queueMicrotask(() => peer.onmessage?.({data: structuredClone(data)}));
        }
    }

    close() { Channel.open.delete(this); }
}

const context = async () => {
    vi.resetModules();
    return (await import("../../local")).default;
};
const record = key => ["meta", {id: key, _: true}];

beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("BroadcastChannel", Channel);
    Channel.open.clear();
    Channel.messages.length = 0;
});
afterEach(() => {
    for (const channel of Channel.open) channel.close();
    vi.unstubAllGlobals();
});

it("delivers one matching change across contexts without echo or storageKey leakage", async () => {
    const LocalA = await context();
    const writer = new LocalA({storageKey: "shared"});
    const LocalB = await context();
    const reader = new LocalB({storageKey: "shared"});
    const isolated = new LocalB({storageKey: "errors"});
    const events = []; const wrong = vi.fn();
    const one = reader.cursor("meta", {orderBy: "score", start: 2}).subscribe(event => events.push(event));
    const two = isolated.cursor("meta").subscribe(wrong);
    await vi.waitFor(() => expect(Channel.open.size).toBe(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    await writer.update(record("a"), () => ({score: 1}));
    await writer.update(record("a"), () => ({score: 2}));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({type: "add", entry: {key: "a", value: {score: 2}}});
    expect(wrong).not.toHaveBeenCalled();
    expect(Channel.messages).toHaveLength(2);
    expect(JSON.stringify(Channel.messages)).not.toContain("score");
    one.unsubscribe(); two.unsubscribe();
    expect(Channel.open.size).toBe(0);
});
