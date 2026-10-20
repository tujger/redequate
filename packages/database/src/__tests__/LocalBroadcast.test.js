import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";

class MockBroadcastChannel {
    static channels = new Set();
    static messages = [];

    constructor(name) {
        this.name = name;
        this.closed = false;
        MockBroadcastChannel.channels.add(this);
    }

    postMessage(data) {
        MockBroadcastChannel.messages.push({name: this.name, data});
        for (const peer of MockBroadcastChannel.channels) {
            if (peer !== this && !peer.closed && peer.name === this.name) {
                queueMicrotask(() => { if (!peer.closed) peer.onmessage?.({data: structuredClone(data)}); });
            }
        }
    }

    close() {
        this.closed = true;
        MockBroadcastChannel.channels.delete(this);
    }
}

const record = id => ["records", {id, _: true}];
const created = value => ({...value, timestamp: expect.any(Number)});
const context = async () => {
    vi.resetModules();
    return (await import("../local")).default;
};

beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    MockBroadcastChannel.channels.clear();
    MockBroadcastChannel.messages.length = 0;
});

afterEach(() => {
    for (const channel of MockBroadcastChannel.channels) channel.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it("shares one channel between local instances and refreshes another context once without echo", async () => {
    const LocalA = await context();
    const first = new LocalA({storageKey: "shared"});
    const second = new LocalA({storageKey: "shared"});
    const LocalB = await context();
    const remote = new LocalB({storageKey: "shared"});
    const one = vi.fn(), two = vi.fn(), other = vi.fn();
    const handles = [first.addEventListener(["records"], {onChange: one}),
        second.addEventListener(["records"], {onChange: two}),
        remote.addEventListener(["records"], {onChange: other})];
    await vi.waitFor(() => expect(other).toHaveBeenCalledOnce());
    expect(MockBroadcastChannel.channels.size).toBe(2);
    await first.write(record("a"), {name: "private value"});
    await vi.waitFor(() => expect(other).toHaveBeenCalledTimes(2));
    expect(one).toHaveBeenCalledTimes(2);
    expect(two).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenLastCalledWith({a: created({name: "private value"})});
    expect(MockBroadcastChannel.messages).toHaveLength(1);
    expect(JSON.stringify(MockBroadcastChannel.messages[0].data)).not.toContain("private value");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(MockBroadcastChannel.messages).toHaveLength(1);
    handles.forEach(handle => handle.remove());
    expect(MockBroadcastChannel.channels.size).toBe(0);
});

it("filters unrelated paths and keeps storage keys isolated", async () => {
    const LocalA = await context();
    const writer = new LocalA({storageKey: "alpha"});
    const LocalB = await context();
    const remote = new LocalB({storageKey: "alpha"});
    const isolated = new LocalB({storageKey: "beta"});
    const exact = vi.fn(), other = vi.fn(), wrongKey = vi.fn();
    const handles = [remote.addEventListener(record("a"), {onChange: exact}),
        remote.addEventListener(record("b"), {onChange: other}),
        isolated.addEventListener(["records"], {onChange: wrongKey})];
    await vi.waitFor(() => expect(wrongKey).toHaveBeenCalledOnce());
    const open = vi.spyOn(indexedDB, "open");
    await writer.write(record("a"), {name: "first"});
    await vi.waitFor(() => expect(exact).toHaveBeenCalledTimes(2));
    expect(other).toHaveBeenCalledOnce();
    expect(wrongKey).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledTimes(2); // committed write and matching remote reread
    expect(MockBroadcastChannel.messages[0].name).toContain("alpha");
    expect(MockBroadcastChannel.messages[0].name).not.toContain("beta");
    handles.forEach(handle => handle.remove());
});

it("sends one batch notice after commit and none after abort", async () => {
    const LocalA = await context();
    const writer = new LocalA({storageKey: "batch"});
    const LocalB = await context();
    const remote = new LocalB({storageKey: "batch"});
    const onChange = vi.fn();
    const handle = remote.addEventListener(["records"], {onChange});
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    await writer.update(new Map([[record("a"), {score: 1}], [record("b"), {score: 2}]]));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(MockBroadcastChannel.messages).toHaveLength(1);
    await expect(writer.update(new Map([[record("a"), {score: 3}], [record("b"), {bad: () => 1}]])))
        .rejects.toBeInstanceOf(Error);
    expect(MockBroadcastChannel.messages).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    handle.remove();
});

it("works without BroadcastChannel", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const LocalDatabase = await context();
    const database = new LocalDatabase({storageKey: "offline"});
    const onChange = vi.fn();
    const handle = database.addEventListener(["records"], {onChange});
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    await database.write(record("a"), {score: 1});
    expect(onChange).toHaveBeenCalledTimes(2);
    handle.remove();
});
