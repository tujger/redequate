import {IDBFactory} from "fake-indexeddb";
import ExtraListener from "../common/handlers/extra";
import LocalBackend from "../local";
import LocalDatabase from "../../../database/src/local";

const value = {id: "p1", uid: "reactor", type: "like"};
const params = {extra_id: "e1"};
const ownerPath = ["posts", {post_id: "p1"}, "uid"];
let backend, listener;
beforeEach(() => {
    backend = {
        TIMESTAMP: {".sv": "timestamp"},
        increment: vi.fn(n => ({delta: n})),
        request: vi.fn(async name => name === "database.read" ? "author" : name === "database.create" ? "alert-key" : null),
    };
    listener = new ExtraListener(backend);
});

it("updates the counter, reads the author, then creates the original alert payload", async () => {
    await listener.onCreate({value, params});
    expect(backend.request.mock.calls).toEqual([
        ["database.update", ["_counters", {id: "p1"}, "like"], {delta: 1}],
        ["database.read", ownerPath],
        ["database.create", ["alerts", {user_id: "author"}, "alert_id"], {
            uid: "reactor", context: null, id: "p1", message: null,
            new: true, path: null, timestamp: backend.TIMESTAMP, type: "like",
        }],
    ]);
    expect(backend.request.mock.calls[2][2].timestamp).toBe(backend.TIMESTAMP);
});

it.each([null, "reactor"])("does not create an alert for author %j but retains the counter change", async author => {
    backend.request.mockImplementation(async name => name === "database.read" ? author : null);
    await listener.onCreate({value, params});
    expect(backend.request.mock.calls.map(([name]) => name)).toEqual(["database.update", "database.read"]);
});

it("uses null for an absent reaction author", async () => {
    await listener.onCreate({value: {...value, uid: undefined}, params});
    expect(backend.request.mock.calls[2][2].uid).toBeNull();
});

it.each([1, 2, 3])("propagates failure at operation %s without starting later operations", async operation => {
    const failure = new Error("backend unavailable");
    const invoke = backend.request.getMockImplementation();
    let calls = 0;
    backend.request.mockImplementation((...args) => ++calls === operation ? Promise.reject(failure) : invoke(...args));
    await expect(listener.onCreate({value, params})).rejects.toBe(failure);
    expect(backend.request).toHaveBeenCalledTimes(operation);
});

it("leaves deletion and updates unchanged", async () => {
    await listener.onDelete({value, params});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", ["_counters", {id: "p1"}, "like"], {delta: -1});
    backend.request.mockClear();
    await listener.onUpdate({value, previous: value, params});
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
    expect(await backend.request("database.read", ["_counters", {id: "p1"}, "like"])).toBe(1);
    expect(await backend.request("database.read", ownerPath)).toBe("author");
});

it.each(["self", "missing", "no-author"])("suppresses Local alerts for %s reactions", async kind => {
    const {database, backend} = await local();
    if (kind !== "missing") await database.create(["posts", {post_id: "p1"}], kind === "self" ? {uid: "reactor"} : {text: "no author"});
    await database.create(["extra", {extra_id: "e1"}], value);
    await vi.waitFor(async () => expect(await backend.request("database.read", ["_counters", {id: "p1"}, "like"])).toBe(1));
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
    await expect(backend.request("database.read", ownerPath, {})).rejects.toMatchObject({code: "database/invalid-argument"});
});
