import {IDBFactory, IDBDatabase, IDBObjectStore} from "fake-indexeddb";
import LocalBackend from "../local";
import LocalDatabase from "../../../database/src/local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const prepare = async (storageId, stores) => {
    const database = new LocalDatabase({storageId, stores});
    await database.read(["posts"]);
    return database;
};

it("creates in prepared storage without calling LocalDatabase.create and preserves markers", async () => {
    const database = await prepare("prepared-direct");
    const backend = new LocalBackend({storageId: database.storageId});
    const create = vi.spyOn(database, "create").mockImplementation(() => { throw new Error("recursive create"); });
    const key = await backend.request("database.create", ["posts", "post_id"], id => ({
        id, count: database.increment(2), time: database.TIMESTAMP
    }));
    expect(key).toBe("1");
    expect(await database.read(["posts", {post_id: key}])).toEqual({id: key, count: 2, time: expect.any(Number)});
    expect(create).not.toHaveBeenCalled();
    await expect(backend.request("database.create", ["posts", {post_id: key}], {}))
        .rejects.toMatchObject({name: "ConstraintError"});
});

it("creates in a prepared custom store without receiving its schema", async () => {
    const stores = [{store: "audit", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: []}];
    const database = await prepare("prepared-custom", stores);
    const backend = new LocalBackend({storageId: database.storageId});
    expect(await backend.request("database.create", ["audit", {id: "a"}], {value: 1})).toBe("a");
    expect(await database.read(["audit", {id: "a"}])).toEqual({value: 1});
});

it("keeps named identities, nested paths, and colliding metadata fields compatible with readers", async () => {
    const database = await prepare("prepared-format");
    const backend = new LocalBackend({storageId: database.storageId});
    const path = ["posts", {post_id: "p1"}, "edit", {edit_id: "e1"}];
    const value = {_id: "public-id", _local: {public: true}, value: false, nested: {list: [1, 2]}};
    expect(await backend.request("database.create", path, value)).toBe("e1");
    expect(await database.read(path)).toEqual(value);
    const key = await backend.request("database.create", ["posts", {post_id: "p1"}, "edit", "edit_id"], id => ({id}));
    expect(await database.read(["posts", {post_id: "p1"}, "edit", {edit_id: key}])).toEqual({id: key});
});

it("rolls back callback failures and generated keys, and never runs a callback for a duplicate", async () => {
    const database = await prepare("prepared-rollback");
    const backend = new LocalBackend({storageId: database.storageId});
    const failure = new Error("callback failed");
    await expect(backend.request("database.create", ["posts", "post_id"], () => { throw failure; })).rejects.toBe(failure);
    await expect(backend.request("database.create", ["posts", "post_id"], async () => ({})))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await backend.request("database.create", ["posts", "post_id"], {})).toBe("1");
    const callback = vi.fn(() => ({}));
    await expect(backend.request("database.create", ["posts", {post_id: "1"}], callback))
        .rejects.toMatchObject({name: "ConstraintError"});
    expect(callback).not.toHaveBeenCalled();
});

it("rolls back a native write failure and serializes concurrent allocations", async () => {
    const database = await prepare("prepared-native-rollback");
    const backend = new LocalBackend({storageId: database.storageId});
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => { throw new Error("write failed"); });
    await expect(backend.request("database.create", ["posts", "post_id"], {})).rejects.toThrow("write failed");
    put.mockRestore();
    const keys = await Promise.all(Array.from({length: 4}, (_, i) => backend.request("database.create", ["posts", "post_id"], {i})));
    expect(keys).toEqual(["1", "2", "3", "4"]);
});

it("does not initialize stores and closes connections after success or failure", async () => {
    const database = await prepare("prepared-close");
    const close = vi.spyOn(IDBDatabase.prototype, "close");
    const backend = new LocalBackend({storageId: database.storageId});
    await backend.request("database.create", ["posts", {post_id: "p1"}], {});
    expect(close).toHaveBeenCalledTimes(1);
    await expect(backend.request("database.create", ["unknown", {id: "a"}], {})).rejects.toMatchObject({name: "NotFoundError"});
    expect(close).toHaveBeenCalledTimes(2);
    await expect(backend.request("database.create", ["posts", {post_id: "p1"}], {})).rejects.toMatchObject({name: "ConstraintError"});
    expect(close).toHaveBeenCalledTimes(3);
    await expect(new LocalBackend({storageId: "empty-storage"}).request("database.create", ["posts", "post_id"], {}))
        .rejects.toMatchObject({name: "NotFoundError"});
});

it("validates arguments, rejects service stores, and uses the default storage ID", async () => {
    const database = await prepare(undefined);
    const backend = new LocalBackend();
    expect(await backend.request("database.create", ["posts", {post_id: "p1"}], {})).toBe("p1");
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual({});
    await expect(backend.request("database.create", ["posts", "post_id"]))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(backend.request("database.create", ["$auth", {id: "a"}], {}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    for (const storageId of ["", "  ", null, 1]) {
        expect(() => new LocalBackend({storageId})).toThrow("storageId must be a non-empty string.");
    }
});
