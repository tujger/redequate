import {IDBFactory} from "fake-indexeddb";
import {milliseconds, resetLastTimestamp} from "firebase-key";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local";
import resolveDatabase from "../../resolveDatabase";
import createLocalDatabase from "../createLocalDatabase";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("prepares a callback with its final key and sends only the prepared path and object", async () => {
    const calls = [];
    const value = {title: "ready"};
    const backend = {request: vi.fn(async (name, path, prepared) => {
        calls.push("request");
        expect(name).toBe("database.create");
        expect(prepared).toBe(value);
        return path.at(-1).post_id;
    })};
    const database = new LocalDatabase({backend, storageId: "create-request"});
    let callbackKey;
    const key = await database.create(["posts", "post_id"], id => {
        callbackKey = id;
        calls.push("callback");
        return value;
    });
    expect(calls).toEqual(["callback", "request"]);
    expect(key).toBe(callbackKey);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["posts", {post_id: key}], value);
});

it("uses the supplied key, returns the backend result and reports backend errors once", async () => {
    const onError = vi.fn();
    const backend = {request: vi.fn().mockResolvedValue("committed-key")};
    const database = new LocalDatabase({backend, storageId: "create-result", onError});
    const callback = vi.fn(key => ({key}));
    const path = ["posts", {post_id: "manual"}];
    expect(await database.create(path, callback)).toBe("committed-key");
    expect(callback).toHaveBeenCalledExactlyOnceWith("manual");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", path, {key: "manual"});
    const error = new Error("backend failed");
    backend.request.mockRejectedValueOnce(error);
    expect(await database.create(path, callback)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "create", {path, value: callback});
});

it("rejects invalid prepared values and failed callbacks before contacting backend", async () => {
    const backend = {request: vi.fn()};
    const database = new LocalDatabase({backend, storageId: "create-invalid"});
    const path = ["posts", "post_id"];
    const error = new Error("callback failed");
    await expect(database.create(path, () => { throw error; })).rejects.toBe(error);
    for (const value of [null, [], 1, () => null, async () => ({})]) {
        await expect(database.create(path, value)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(backend.request).not.toHaveBeenCalled();
});

it("has no fallback backend and resolveDatabase forwards the supplied dependency", async () => {
    const database = new LocalDatabase({storageId: "missing-backend"});
    await expect(database.create(["posts", "post_id"], {})).rejects.toBeInstanceOf(TypeError);
    const backend = {request: vi.fn().mockResolvedValue("returned")};
    const resolved = await resolveDatabase(undefined, {backend});
    expect(await resolved.create(["posts", {post_id: "manual"}], {})).toBe("returned");
    expect(await resolveDatabase(resolved, {backend: new LocalBackend()})).toBe(resolved);
});

it("generates strictly ordered IDs in the same millisecond and after a clock rollback", async () => {
    resetLastTimestamp();
    let now = 1800000000000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
        const database = createLocalDatabase({storageId: "monotonic-keys"});
        await database.read(["posts"]);
        const first = await database.create(["posts", "post_id"], {});
        const callback = vi.fn(id => ({id}));
        const second = await database.create(["posts", "post_id"], callback);
        now -= 10000;
        const third = await database.create(["posts", "post_id"], {});
        now += 20000;
        const fourth = await database.create(["posts", "post_id"], {});
        expect(first < second && second < third && third < fourth).toBe(true);
        expect(milliseconds(first)).toBe(1800000000000);
        expect(milliseconds(fourth)).toBe(now);
        expect(callback).toHaveBeenCalledExactlyOnceWith(second);
        expect((await database.cursor("posts").next(10)).map(({key}) => key)).toEqual([first, second, third, fourth]);
    } finally {
        clock.mockRestore();
        resetLastTimestamp();
    }
});

it("only prepares arguments and delegates without opening IndexedDB", async () => {
    const open = vi.fn(() => { throw new Error("database.create must not access IndexedDB"); });
    vi.stubGlobal("indexedDB", {open});
    const backend = {request: vi.fn().mockResolvedValue("saved-key")};
    const database = new LocalDatabase({backend, storageId: "delegated-only"});
    const value = {title: "prepared"};
    expect(await database.create(["custom", {id: "manual"}], () => value)).toBe("saved-key");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["custom", {id: "manual"}], value);
    expect(open).not.toHaveBeenCalled();
});
