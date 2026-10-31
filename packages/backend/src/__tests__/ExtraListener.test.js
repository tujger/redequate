import {IDBFactory, IDBDatabase} from "fake-indexeddb";
import ExtraListener from "../common/handlers/extra";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";

const value = {id: "p1", uid: "reactor", type: "like"};
const params = {extra_id: "e1"};
const ownerPath = ["posts", {post_id: "p1"}, {uid: "uid"}];
let backend, listener;
beforeEach(() => {
    backend = {
        TIMESTAMP: {".sv": "timestamp"},
        increment: vi.fn(n => ({delta: n})),
        request: vi.fn(async (name, path, value, options) => name === "database.update"
            ? options.mode === "read" ? {value: null, etag: "initial"} : {committed: true, value}
            : name === "database.read" ? "author" : "alert-key"),
    };
    listener = new ExtraListener(backend);
});

it("updates the counter, reads the author, then creates the original alert payload", async () => {
    await listener.onCreate({value, params});
    expect(backend.request.mock.calls).toEqual([
        ["database.update", ["_counters", {id: "p1"}, "like"], null, {mode: "read"}],
        ["database.update", ["_counters", {id: "p1"}, "like"], 1, {mode: "replace", etag: "initial"}],
        ["database.read", ownerPath],
        ["database.create", ["alerts", {user_id: "author"}, "alert_id"], {
            uid: "reactor", context: null, id: "p1", message: null,
            new: true, path: null, timestamp: backend.TIMESTAMP, type: "like",
        }],
    ]);
    expect(backend.request.mock.calls[3][2].timestamp).toBe(backend.TIMESTAMP);
});

it.each([null, "reactor"])("does not create an alert for author %j but retains the counter change", async author => {
    const invoke = backend.request.getMockImplementation();
    backend.request.mockImplementation((name, ...args) => name === "database.read" ? author : invoke(name, ...args));
    await listener.onCreate({value, params});
    expect(backend.request.mock.calls.map(([name]) => name)).toEqual(["database.update", "database.update", "database.read"]);
});

it("uses null for an absent reaction author", async () => {
    await listener.onCreate({value: {...value, uid: undefined}, params});
    expect(backend.request.mock.calls[3][2].uid).toBeNull();
});

it.each([1, 2, 3, 4])("propagates failure at operation %s without starting later operations", async operation => {
    const failure = new Error("backend unavailable");
    const invoke = backend.request.getMockImplementation();
    let calls = 0;
    backend.request.mockImplementation((...args) => ++calls === operation ? Promise.reject(failure) : invoke(...args));
    await expect(listener.onCreate({value, params})).rejects.toBe(failure);
    expect(backend.request).toHaveBeenCalledTimes(operation);
});

it("deletes an empty counter and leaves updates unchanged", async () => {
    await listener.onDelete({value, params});
    expect(backend.request).toHaveBeenCalledTimes(2);
    expect(backend.request).toHaveBeenLastCalledWith("database.update", ["_counters", {id: "p1"}, "like"], null, {mode: "replace", etag: "initial"});
    backend.request.mockClear();
    expect(listener.onUpdate).toBeUndefined();
    expect(backend.request).not.toHaveBeenCalled();
});

let nextId = 0;
const local = async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const storageId = `extra-alert-${++nextId}`;
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["posts"]);
    return {backend, database};
};
afterEach(() => vi.unstubAllGlobals());

it("persists a Local extra → counter → alert reaction chain with a resolved timestamp", async () => {
    const {database, backend} = await local();
    await database.create(["posts", {post_id: "p1"}], {uid: "author", text: "post"});
    await database.create(["extra", {extra_id: "e1"}], value);
    await vi.waitFor(async () => {
        const alerts = await database.read(["alerts", {user_id: "author"}, "alert_id"]);
        expect(Object.values(alerts ?? {})).toEqual([{
            uid: "reactor", context: null, id: "p1", message: null,
            new: true, path: null, timestamp: expect.any(Number), type: "like",
        }]);
    });
    expect(await backend.request("database.read", ["_counters", {id: "p1"}, {like: "like"}])).toBe(1);
    expect(await backend.request("database.read", ownerPath)).toBe("author");
});

it.each(["self", "missing", "no-author"])("suppresses Local alerts for %s reactions", async kind => {
    const {database, backend} = await local();
    if (kind !== "missing") await database.create(["posts", {post_id: "p1"}], kind === "self" ? {uid: "reactor"} : {text: "no author"});
    await database.create(["extra", {extra_id: "e1"}], value);
    await vi.waitFor(async () => expect(await backend.request("database.read", ["_counters", {id: "p1"}, {like: "like"}])).toBe(1));
    // Await a read issued after the reaction's owner lookup before checking the absence of alerts.
    await backend.request("database.read", ownerPath);
    expect(await database.read(["alerts", "alert_id"])).toBeUndefined();
});

it("Local internal reads preserve falsy values, require one path and do not publish writes", async () => {
    const {database, backend} = await local();
    await database.update(new Map([[["meta", "settings"], {zero: 0, flag: false}]]));
    expect(await backend.request("database.read", ["meta", "settings", "zero"])).toBe(0);
    expect(await backend.request("database.read", ["meta", "settings", "flag"])).toBe(false);
    expect(await backend.request("database.read", ["meta", "settings", "missing"])).toBeNull();
    await expect(backend.request("database.read")).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(backend.request("database.read", ownerPath, {unexpected: true})).rejects.toMatchObject({code: "database/invalid-argument"});
});


it("validates Local read paths and closes the database when the store is missing", async () => {
    const {backend} = await local();
    for (const path of [null, "", [], ["$auth"]]) {
        await expect(backend.request("database.read", path)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    const close = vi.spyOn(IDBDatabase.prototype, "close");
    await expect(backend.request("database.read", ["missing-store"]))
        .rejects.toMatchObject({name: "NotFoundError"});
    expect(close).toHaveBeenCalledTimes(1);
});


it("skips absent deleted extras without touching a counter", async () => {
    await listener.onDelete({value: null, params});
    expect(backend.request).not.toHaveBeenCalled();
});

it("Local extra deletion removes a counter at zero and preserves the original alert", async () => {
    const {backend, database} = await local();
    await database.create(["posts", {post_id: "p1"}], {uid: "author"});
    const target = ["extra", {extra_id: "e1"}];
    await database.create(target, value);
    await vi.waitFor(async () => expect(Object.keys(await database.read(["alerts", {user_id: "author"}, "alert_id"]) ?? {})).toHaveLength(1));
    await database.delete(target);
    await vi.waitFor(async () => expect(await backend.request("database.read", ["_counters", {id: "p1"}, {like: "like"}])).toBeNull());
    expect(Object.keys(await database.read(["alerts", {user_id: "author"}, "alert_id"]))).toHaveLength(1);
});
