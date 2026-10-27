import {IDBFactory} from "fake-indexeddb";

class Channel {
    static open = new Set();
    static messages = [];
    constructor(name) { this.name = name; Channel.open.add(this); }
    postMessage(data) {
        Channel.messages.push({name: this.name, data});
        for (const peer of Channel.open) if (peer !== this && peer.name === this.name) {
            queueMicrotask(() => peer.onmessage?.({data: structuredClone(data)}));
        }
    }
    close() { Channel.open.delete(this); }
}

beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("BroadcastChannel", Channel);
    Channel.open.clear(); Channel.messages.length = 0;
});
afterEach(() => {
    for (const channel of Channel.open) channel.close();
    vi.unstubAllGlobals();
});
const context = async () => {
    vi.resetModules();
    return {Database: (await import("../../local")).default, Backend: (await import("../../../../backend/src/local")).default};
};

it("notifies across independent contexts using collection names only, without echo", async () => {
    const A = await context(), B = await context();
    const writer = new A.Database({storageId: "shared-native", backend: new A.Backend({storageId: "shared-native"})});
    const reader = new B.Database({storageId: "shared-native", backend: new B.Backend({storageId: "shared-native"})});
    const isolated = new B.Database({storageId: "separate-native", backend: new B.Backend({storageId: "separate-native"})});
    await writer.read(["posts"]);
    const events = [], wrong = vi.fn();
    const one = reader.cursor(["posts", "post_id"]).subscribe(event => events.push(event));
    const two = isolated.cursor(["posts", "post_id"]).subscribe(wrong);
    const initial = vi.fn(), separateInitial = vi.fn();
    const ready = reader.addEventListener(["posts"], {onChange: initial});
    const separateReady = isolated.addEventListener(["posts"], {onChange: separateInitial});
    try {
        await vi.waitFor(() => {
            expect(initial).toHaveBeenCalledTimes(1);
            expect(separateInitial).toHaveBeenCalledTimes(1);
        });
        await writer.create(["posts", {post_id: "p1"}], {title: "A"});
        await vi.waitFor(() => expect(events).toHaveLength(1));
        expect(events[0]).toMatchObject({type: "add", entry: {key: "p1", value: {title: "A"}}});
        await writer.update(["posts", {post_id: "p1"}], {title: "B"});
        await vi.waitFor(() => expect(events).toHaveLength(2));
        expect(events[1].type).toBe("change");
        expect(wrong).not.toHaveBeenCalled();
        expect(Channel.messages.every(message => JSON.stringify(message.data) === '{"collections":["posts"]}')).toBe(true);
    } finally { one.unsubscribe(); two.unsubscribe(); ready.remove(); separateReady.remove(); }
    expect(Channel.open.size).toBe(0);
});
