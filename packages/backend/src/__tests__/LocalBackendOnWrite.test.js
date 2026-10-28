import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local";
import onWrite from "../local/database/onWrite";
import LocalDatabase from "../../../database/src/local";

const callbacks = vi.hoisted(() => ({extra: vi.fn(), post: vi.fn()}));
vi.mock("../common", () => ({handlers: {
    extra: {path: ["extra", "extra_id"], onWrite: props => callbacks.extra(props)},
    post: {path: ["posts", "post_id"], onWrite: props => callbacks.post(props)},
}}));

class Channel {
    static open = new Set();
    static messages = [];
    constructor(name) { this.name = name; Channel.open.add(this); }
    postMessage(data) {
        Channel.messages.push(structuredClone(data));
        for (const peer of Channel.open) if (peer !== this && peer.name === this.name) {
            queueMicrotask(() => peer.onmessage?.({data: structuredClone(data)}));
        }
    }
    close() { Channel.open.delete(this); }
}
let nextId = 0;
beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("BroadcastChannel", Channel);
    Channel.messages.length = 0;
    callbacks.extra.mockReset(); callbacks.post.mockReset();
});
afterEach(() => {
    expect(Channel.open.size).toBe(0);
    vi.unstubAllGlobals();
});
const setup = async () => {
    const storageId = `onwrite-${++nextId}`;
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["extra"]);
    return {backend, database, storageId};
};
const target = id => ["extra", {extra_id: id}];
const events = () => callbacks.extra.mock.calls.map(([{value, previous, params}]) => ({value, previous, params}));

it("delivers creation, nested updates and deletion after commit without physical fields", async () => {
    const {database, backend} = await setup();
    await database.create(target("a"), {type: "like", details: {count: 1}});
    await database.update([...target("a"), "details"], {count: 2});
    await database.delete(target("a"));
    await vi.waitFor(() => expect(callbacks.extra).toHaveBeenCalledTimes(3));
    expect(events()).toEqual([
        {previous: null, value: {type: "like", details: {count: 1}}, params: {extra_id: "a"}},
        {previous: {type: "like", details: {count: 1}}, value: {type: "like", details: {count: 2}}, params: {extra_id: "a"}},
        {previous: {type: "like", details: {count: 2}}, value: null, params: {extra_id: "a"}},
    ]);
    expect(callbacks.extra.mock.calls[0][0].backend).toBe(backend);
    expect(Channel.messages.filter(message => message.changes)).toHaveLength(3);
});

it("does not replay existing records or duplicate registrations for one database", async () => {
    const {database, storageId} = await setup();
    await database.create(target("a"), {type: "like"});
    callbacks.extra.mockClear();
    new LocalBackend({storageId});
    expect(callbacks.extra).not.toHaveBeenCalled();
    await database.update(target("a"), {type: "dislike"});
    expect(callbacks.extra).toHaveBeenCalledTimes(1);
});

it("preserves intermediate snapshots during consecutive writes", async () => {
    const {backend} = await setup();
    await Promise.all([1, 2, 3].map(count => backend.request("database.update", target("a"), {count})));
    await vi.waitFor(() => expect(callbacks.extra).toHaveBeenCalledTimes(3));
    expect(events().map(({previous, value}) => [previous?.count ?? null, value.count])).toEqual([[null, 1], [1, 2], [2, 3]]);
});

it("emits one final record event for a batch and nothing for reads, no-ops or CAS conflicts", async () => {
    const {backend, database} = await setup();
    await database.create(target("a"), {type: "like", count: 1});
    callbacks.extra.mockClear();
    await backend.request("database.update", "", new Map([
        [[...target("a"), "type"], "dislike"], [[...target("a"), "count"], 2],
    ]));
    expect(events()).toEqual([{previous: {type: "like", count: 1}, value: {type: "dislike", count: 2}, params: {extra_id: "a"}}]);
    callbacks.extra.mockClear();
    const snapshot = await backend.request("database.update", target("a"), null, {mode: "read"});
    await backend.request("database.update", target("a"), snapshot.value, {mode: "replace", etag: snapshot.etag});
    await backend.request("database.update", target("a"), {}, {mode: "replace", etag: "stale"});
    await database.delete(target("absent"));
    expect(callbacks.extra).not.toHaveBeenCalled();
});

it("does not publish an aborted batch", async () => {
    const {backend, database} = await setup();
    await expect(backend.request("database.update", "", new Map([
        [target("a"), {type: "like"}], [target("b"), {extra_id: "wrong", type: "like"}],
    ]))).rejects.toThrow();
    expect(await database.read(target("a"))).toBeUndefined();
    expect(callbacks.extra).not.toHaveBeenCalled();
    expect(Channel.messages).toHaveLength(0);
});

it("allows awaited reactions to produce further writes without deadlock", async () => {
    const {database} = await setup();
    callbacks.extra.mockImplementation(async ({params, backend}) => {
        if (params.extra_id === "a") await backend.request("database.update", ["posts", {post_id: "p"}], {text: "reaction"});
    });
    callbacks.post.mockImplementation(async ({backend}) => {
        await backend.request("database.update", target("b"), {type: "response"});
    });
    await database.create(target("a"), {type: "like"});
    await vi.waitFor(() => expect(callbacks.extra).toHaveBeenCalledTimes(2));
    expect(callbacks.post).toHaveBeenCalledTimes(1);
    expect(await database.read(target("b"))).toEqual({type: "response"});
});

it("reports rejected reactions without failing the committed request or other reactions", async () => {
    const {database} = await setup();
    const error = new Error("reaction failed"), report = vi.spyOn(console, "error").mockImplementation(() => {});
    callbacks.extra.mockRejectedValue(error);
    await database.create(target("a"), {type: "like"});
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(error));
    expect(await database.read(target("a"))).toEqual({type: "like"});
    await database.create(["posts", {post_id: "p"}], {text: "ok"});
    expect(callbacks.post).toHaveBeenCalledTimes(1);
});

it("isolates storage IDs and executes reactions only in the writing context", async () => {
    const {database, storageId, backend} = await setup();
    vi.resetModules();
    const OtherBackend = (await import("../local")).default;
    const OtherDatabase = (await import("../../../database/src/local")).default;
    const remote = new OtherBackend({storageId});
    const remoteDatabase = new OtherDatabase({storageId, backend: remote});
    const separate = new OtherBackend({storageId: `${storageId}-other`});
    new OtherDatabase({storageId: separate.storageId, backend: separate});
    await database.create(target("a"), {type: "like"});
    expect(callbacks.extra).toHaveBeenCalledTimes(1);
    expect(callbacks.extra.mock.calls[0][0].backend).toBe(backend);
    await remoteDatabase.update(target("a"), {type: "dislike"});
    expect(callbacks.extra).toHaveBeenCalledTimes(2);
    expect(callbacks.extra.mock.calls[1][0].backend).toBe(remote);
});


it("delivers to independent subscribers and releases removed subscriptions", async () => {
    const {backend, database} = await setup();
    const first = vi.fn(() => { throw new Error("subscriber failed"); });
    const second = vi.fn();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const removeFirst = onWrite({path: ["extra", "extra_id"], onWrite: first})(backend);
    const removeSecond = onWrite({path: ["extra", "extra_id"], onWrite: second})(backend);
    try {
        await database.create(target("a"), {type: "like"});
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(report).toHaveBeenCalledTimes(1);
        removeFirst();
        await database.update(target("a"), {type: "dislike"});
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
    } finally { removeFirst(); removeSecond(); }
});

it("delivers reactions without BroadcastChannel support", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const {database} = await setup();
    await database.create(target("a"), {type: "like"});
    expect(callbacks.extra).toHaveBeenCalledTimes(1);
});
