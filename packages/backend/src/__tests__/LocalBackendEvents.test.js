import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local";
import onEvents from "../local/database/onEvents";
import LocalDatabase from "../../../database/src/local";
import BackendListener from "../common/BackendListener";

const {callbacks, sequence} = vi.hoisted(() => ({
    sequence: [],
    callbacks: Object.fromEntries(["extra", "post"].map(name => [name, {create: vi.fn(), delete: vi.fn(), update: vi.fn()}])),
}));
vi.mock("../common", () => ({handlers: {
    extra: class {
        constructor(backend) { this.backend = backend; this.path = ["extra", "extra_id"]; }
        onCreate(props) { sequence.push("create"); return callbacks.extra.create.call(this, props); }
        onDelete(props) { sequence.push("delete"); return callbacks.extra.delete.call(this, props); }
        onUpdate(props) { sequence.push("update"); return callbacks.extra.update.call(this, props); }
    },
    post: class {
        constructor(backend) { this.backend = backend; this.path = ["posts", "post_id"]; }
        onCreate(props) { return callbacks.post.create.call(this, props); }
        onDelete(props) { return callbacks.post.delete.call(this, props); }
        onUpdate(props) { return callbacks.post.update.call(this, props); }
    },
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
    sequence.length = 0;
    for (const group of Object.values(callbacks)) for (const callback of Object.values(group)) callback.mockReset();
});
afterEach(() => {
    expect(Channel.open.size).toBe(0);
    vi.unstubAllGlobals();
});
const setup = async () => {
    const storageId = `events-${++nextId}`;
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["extra"]);
    return {backend, database, storageId};
};
const target = id => ["extra", {extra_id: id}];
const events = () => ["create", "update", "delete"].flatMap(name => callbacks.extra[name].mock.calls.map(([event]) => event));

it("delivers creation, nested updates and deletion after commit without physical fields", async () => {
    const {database, backend} = await setup();
    await database.create(target("a"), {type: "like", details: {count: 1}});
    await database.update([...target("a"), "details"], {count: 2});
    await database.delete(target("a"));
    await vi.waitFor(() => expect(events()).toHaveLength(3));
    expect(events()).toEqual([
        {value: {type: "like", details: {count: 1}}, params: {extra_id: "a"}},
        {previous: {type: "like", details: {count: 1}}, value: {type: "like", details: {count: 2}}, params: {extra_id: "a"}},
        {value: {type: "like", details: {count: 2}}, params: {extra_id: "a"}},
    ]);
    expect(sequence).toEqual(["create", "update", "delete"]);
    for (const event of ["create", "update", "delete"]) expect(callbacks.extra[event]).toHaveBeenCalledTimes(1);
    for (const callback of Object.values(callbacks.post)) expect(callback).not.toHaveBeenCalled();
    expect(callbacks.extra.create.mock.contexts[0].backend).toBe(backend);
    expect(Channel.messages.filter(message => message.changes)).toHaveLength(3);
});

it("does not replay or duplicate registrations for one storage ID", async () => {
    const {database, storageId, backend} = await setup();
    await database.create(target("a"), {type: "like"});
    for (const callback of Object.values(callbacks.extra)) callback.mockClear();
    new LocalBackend({storageId});
    expect(events()).toHaveLength(0);
    await database.update(target("a"), {type: "dislike"});
    expect(callbacks.extra.update).toHaveBeenCalledTimes(1);
    expect(callbacks.extra.update.mock.contexts[0].backend).toBe(backend);
    expect(callbacks.extra.update.mock.calls.every(([event]) => !Object.hasOwn(event, "backend"))).toBe(true);
});

it("preserves intermediate snapshots during consecutive writes", async () => {
    const {backend} = await setup();
    await Promise.all([1, 2, 3].map(count => backend.request("database.update", target("a"), {count})));
    await vi.waitFor(() => expect(events()).toHaveLength(3));
    expect(events().map(({previous, value}) => [previous?.count ?? null, value.count])).toEqual([[null, 1], [1, 2], [2, 3]]);
    expect(callbacks.extra.create.mock.calls[0][0]).toEqual({value: {count: 1}, params: {extra_id: "a"}});
    expect(sequence).toEqual(["create", "update", "update"]);
    expect(callbacks.extra.create).toHaveBeenCalledTimes(1);
    expect(callbacks.extra.update).toHaveBeenCalledTimes(2);
    expect(callbacks.extra.delete).not.toHaveBeenCalled();
});

it("emits one final record event for a batch and nothing for reads, no-ops or CAS conflicts", async () => {
    const {backend, database} = await setup();
    await database.create(target("a"), {type: "like", count: 1});
    for (const callback of Object.values(callbacks.extra)) callback.mockClear();
    await backend.request("database.update", "", new Map([
        [[...target("a"), "type"], "dislike"], [[...target("a"), "count"], 2],
    ]));
    expect(events()).toEqual([{previous: {type: "like", count: 1}, value: {type: "dislike", count: 2}, params: {extra_id: "a"}}]);
    expect(callbacks.extra.create).not.toHaveBeenCalled();
    expect(callbacks.extra.delete).not.toHaveBeenCalled();
    for (const callback of Object.values(callbacks.extra)) callback.mockClear();
    const snapshot = await backend.request("database.update", target("a"), null, {mode: "read"});
    await backend.request("database.update", target("a"), snapshot.value, {mode: "replace", etag: snapshot.etag});
    await backend.request("database.update", target("a"), {}, {mode: "replace", etag: "stale"});
    await database.delete(target("absent"));
    expect(events()).toHaveLength(0);
});

it("classifies a patch upsert as create, then update, and a null write as delete", async () => {
    const {backend} = await setup();
    await backend.request("database.update", target("upsert"), {type: "like"});
    await backend.request("database.update", target("upsert"), {type: "dislike"});
    await backend.request("database.delete", target("upsert"));
    expect(callbacks.extra.create).toHaveBeenCalledTimes(1);
    expect(callbacks.extra.update).toHaveBeenCalledTimes(1);
    expect(callbacks.extra.delete).toHaveBeenCalledTimes(1);
    expect(callbacks.extra.delete.mock.calls[0][0]).toEqual({value: {type: "dislike"}, params: {extra_id: "upsert"}});
});

it("does not publish an aborted batch", async () => {
    const {backend, database} = await setup();
    await expect(backend.request("database.update", "", new Map([
        [target("a"), {type: "like"}], [target("b"), {extra_id: "wrong", type: "like"}],
    ]))).rejects.toThrow();
    expect(await database.read(target("a"))).toBeUndefined();
    expect(events()).toHaveLength(0);
    expect(Channel.messages).toHaveLength(0);
});

it("allows awaited reactions to produce further writes without deadlock", async () => {
    const {database} = await setup();
    callbacks.extra.create.mockImplementation(async function ({params}) {
        const backend = this.backend;
        if (params.extra_id === "a") await backend.request("database.update", ["posts", {post_id: "p"}], {text: "reaction"});
    });
    callbacks.post.create.mockImplementation(async function () {
        const backend = this.backend;
        await backend.request("database.update", target("b"), {type: "response"});
    });
    await database.create(target("a"), {type: "like"});
    await vi.waitFor(() => expect(events()).toHaveLength(2));
    expect(callbacks.post.create).toHaveBeenCalledTimes(1);
    expect(await database.read(target("b"))).toEqual({type: "response"});
});

it("reports rejected reactions without failing the committed request or other reactions", async () => {
    const {database} = await setup();
    const error = new Error("reaction failed"), report = vi.spyOn(console, "error").mockImplementation(() => {});
    callbacks.extra.create.mockRejectedValue(error);
    await database.create(target("a"), {type: "like"});
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(error));
    expect(await database.read(target("a"))).toEqual({type: "like"});
    await database.create(["posts", {post_id: "p"}], {text: "ok"});
    expect(callbacks.post.create).toHaveBeenCalledTimes(1);
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
    expect(callbacks.extra.create).toHaveBeenCalledTimes(1);
    expect(callbacks.extra.create.mock.contexts[0].backend).toBe(backend);
    await remoteDatabase.update(target("a"), {type: "dislike"});
    expect(events()).toHaveLength(2);
    expect(callbacks.extra.update.mock.contexts[0].backend).toBe(remote);
});


it("delivers to independent subscribers and releases removed subscriptions", async () => {
    const {backend, database} = await setup();
    const first = vi.fn(() => { throw new Error("subscriber failed"); });
    const second = vi.fn();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const removeFirst = onEvents({path: ["extra", "extra_id"], onCreate: first})(backend);
    const removeSecond = onEvents({path: ["extra", "extra_id"], onCreate: second, onUpdate: second})(backend);
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

it("keeps the listener instance and backend context for optional event methods", async () => {
    const {backend, database} = await setup();
    class CreateOnly extends BackendListener {
        constructor(backend) { super(["extra", "extra_id"], backend); this.calls = []; }
        onCreate(props) { this.calls.push(props); }
    }
    const listener = new CreateOnly(backend);
    const remove = onEvents(listener)(backend);
    try {
        await database.create(target("a"), {type: "like"});
        await database.update(target("a"), {type: "dislike"});
        await database.delete(target("a"));
        expect(listener.calls).toEqual([{
            value: {type: "like"}, params: {extra_id: "a"},
        }]);
        expect(listener.backend).toBe(backend);
    } finally { remove(); }
});

it("delivers reactions without BroadcastChannel support", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const {database} = await setup();
    await database.create(target("a"), {type: "like"});
    expect(callbacks.extra.create).toHaveBeenCalledTimes(1);
});


it.each(["onCreate", "onUpdate", "onDelete"])("skips missing %s without logging its invocation", async missing => {
    const {backend, database} = await setup();
    const listener = {
        path: ["extra", "extra_id"],
        onCreate: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(),
    };
    delete listener[missing];
    const id = `optional-${missing}`;
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const remove = onEvents(listener, id)(backend);
    try {
        await database.create(target("a"), {type: "like"});
        await database.update(target("a"), {type: "dislike"});
        await database.delete(target("a"));
        const messages = debug.mock.calls.filter(([, message]) => typeof message === "string" && message.includes(`'extra/${id}'`));
        expect(messages.map(([, message]) => message)).toEqual(
            ["onCreate", "onUpdate", "onDelete"].filter(event => event !== missing)
                .map(event => `called '${event}' for 'extra/${id}'`)
        );
        for (const event of ["onCreate", "onUpdate", "onDelete"].filter(event => event !== missing)) {
            expect(listener[event]).toHaveBeenCalledTimes(1);
            expect(listener[event].mock.contexts[0]).toBe(listener);
        }
        expect(report).not.toHaveBeenCalled();
    } finally {
        remove(); debug.mockRestore(); report.mockRestore();
    }
});
