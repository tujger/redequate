import createLocalDatabase from "../createLocalDatabase";
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

const record = id => ["meta", {id, _: true}];
const created = value => value;
const context = async () => {
    vi.resetModules();
    return (await import("../../local")).default;
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
    const first = new LocalA({storageId: "shared"});
    const second = new LocalA({storageId: "shared"});
    const LocalB = await context();
    const remote = new LocalB({storageId: "shared"});
    const one = vi.fn(), two = vi.fn(), other = vi.fn();
    const handles = [first.addEventListener(["meta"], {onChange: one}),
        second.addEventListener(["meta"], {onChange: two}),
        remote.addEventListener(["meta"], {onChange: other})];
    await vi.waitFor(() => expect(other).toHaveBeenCalledOnce());
    expect(MockBroadcastChannel.channels.size).toBe(2);
    await first.update(record("a"), () => ({name: "private value"}));
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

it("applies the same initial key boundary to cross-context child additions", async () => {
    const LocalA = await context();
    const writer = new LocalA({storageId: "child-broadcast"});
    await writer.update(record("10"), () => ({name: "existing"}));
    const LocalB = await context();
    const remote = new LocalB({storageId: "child-broadcast"});
    const added = vi.fn();
    const ready = vi.fn();
    const handle = remote.addEventListener(["meta"], {onChange: ready, onChildAdd: added});
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(added).not.toHaveBeenCalled();
    await writer.update(record("9"), () => ({name: "older"}));
    await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(2));
    expect(added).not.toHaveBeenCalled();
    await writer.update(record("11"), () => ({name: "newer"}));
    await vi.waitFor(() => expect(added).toHaveBeenCalledExactlyOnceWith({key: "11", value: created({name: "newer"})}));
    handle.remove();
});

it("filters unrelated paths and keeps storage keys isolated", async () => {
    const LocalA = await context();
    const writer = new LocalA({storageId: "alpha"});
    const LocalB = await context();
    const remote = new LocalB({storageId: "alpha"});
    const isolated = new LocalB({storageId: "beta"});
    const exact = vi.fn(), other = vi.fn(), wrongKey = vi.fn();
    const handles = [remote.addEventListener(record("a"), {onChange: exact}),
        remote.addEventListener(record("b"), {onChange: other}),
        isolated.addEventListener(["meta"], {onChange: wrongKey})];
    await vi.waitFor(() => expect(wrongKey).toHaveBeenCalledOnce());
    await writer.read(record("a")); // Prepare this instance before measuring notification reads.
    const open = vi.spyOn(indexedDB, "open");
    await writer.update(record("a"), () => ({name: "first"}));
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
    const writer = new LocalA({storageId: "batch"});
    const LocalB = await context();
    const remote = new LocalB({storageId: "batch"});
    const onChange = vi.fn();
    const handle = remote.addEventListener(["meta"], {onChange});
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
    const database = createLocalDatabase({storageId: "offline"});
    const onChange = vi.fn();
    const handle = database.addEventListener(["meta"], {onChange});
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    await database.update(record("a"), () => ({score: 1}));
    expect(onChange).toHaveBeenCalledTimes(2);
    handle.remove();
});

it("normalizes named collection roots across separate contexts", async () => {
    const LocalA = await context(), LocalB = await context();
    const writer = new LocalA({storageId: "named-root"});
    const reader = new LocalB({storageId: "named-root"});
    const onChange = vi.fn();
    const listener = reader.addEventListener([{type: "posts"}, {post_id: "p1"}], {onChange});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
        await writer.update(["posts", {post_id: "p1"}], () => ({text: "string root"}));
        await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(created({text: "string root"})));
        await writer.update([{name: "posts"}, {post_id: "p1"}], () => ({text: "named root"}));
        await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(created({text: "named root"})));
        expect(await reader.read(["posts", {post_id: "p1"}])).toEqual(created({text: "named root"}));
    } finally { listener.remove(); }
});
