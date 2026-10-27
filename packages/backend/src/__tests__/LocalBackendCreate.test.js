import createLocalDatabase from "../../../database/src/__tests__/createLocalDatabase";
import {IDBFactory, IDBDatabase, IDBObjectStore} from "fake-indexeddb";
import LocalBackend from "../local";


beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const prepare = async (storageId, stores) => {
    const database = createLocalDatabase({storageId, stores});
    await database.read(["posts"]);
    return database;
};

it("creates in prepared storage without calling LocalDatabase.create and preserves markers", async () => {
    const database = await prepare("prepared-direct");
    const backend = new LocalBackend({storageId: database.storageId});
    const create = vi.spyOn(database, "create").mockImplementation(() => { throw new Error("recursive create"); });
    const key = await backend.request("database.create", ["posts", "post_id"], {
        count: database.increment(2), time: database.TIMESTAMP
    });
    expect(key).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(await database.read(["posts", {post_id: key}])).toEqual({_id: 1, post_id: key, count: 2, time: expect.any(Number)});
    expect(create).not.toHaveBeenCalled();
    await expect(backend.request("database.create", ["posts", {post_id: key}], {}))
        .rejects.toMatchObject({name: "ConstraintError"});
});

it("creates in a prepared custom store without receiving its schema", async () => {
    const stores = [{store: "audit", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [{name: "id", keypath: "id", options: {unique: true}}]}];
    const database = await prepare("prepared-custom", stores);
    const backend = new LocalBackend({storageId: database.storageId});
    expect(await backend.request("database.create", ["audit", {id: "a"}], {value: 1})).toBe("a");
    expect(await database.read(["audit", {id: "a"}])).toEqual({_id: 1, id: "a", value: 1});
});

it("keeps named identities, nested paths, and ordinary fields compatible with readers", async () => {
    const database = await prepare("prepared-format");
    const backend = new LocalBackend({storageId: database.storageId});
    const path = ["posts", {post_id: "p1"}, "edit", {edit_id: "e1"}];
    const value = {value: false, nested: {list: [1, 2]}};
    expect(await backend.request("database.create", path, value)).toBe("e1");
    expect(await database.read(path)).toEqual(value);
    const key = await backend.request("database.create", ["posts", {post_id: "p1"}, "edit", "edit_id"], {name: "generated"});
    expect(await database.read(["posts", {post_id: "p1"}, "edit", {edit_id: key}])).toEqual({name: "generated"});
});

it("rejects callbacks and asynchronous values without executing them", async () => {
    const database = await prepare("prepared-validation");
    const backend = new LocalBackend({storageId: database.storageId});
    const callback = vi.fn(() => ({}));
    await expect(backend.request("database.create", ["posts", "post_id"], callback))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(backend.request("database.create", ["posts", "post_id"], Promise.resolve({})))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(callback).not.toHaveBeenCalled();
    expect(await database.read(["posts"])).toBeUndefined();
});

it("rolls back a native write failure and serializes concurrent allocations", async () => {
    const database = await prepare("prepared-native-rollback");
    const backend = new LocalBackend({storageId: database.storageId});
    const put = vi.spyOn(IDBObjectStore.prototype, "add").mockImplementationOnce(() => { throw new Error("write failed"); });
    await expect(backend.request("database.create", ["posts", "post_id"], {})).rejects.toThrow("write failed");
    put.mockRestore();
    const keys = await Promise.all(Array.from({length: 4}, (_, i) => backend.request("database.create", ["posts", "post_id"], {i})));
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(4);
    expect(keys.every(key => /^[-0-9A-Z_a-z]{20}$/.test(key))).toBe(true);
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
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual({_id: 1, post_id: "p1"});
    await expect(backend.request("database.create", ["posts", "post_id"]))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(backend.request("database.create", ["$auth", {id: "a"}], {}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    for (const storageId of ["", "  ", null, 1]) {
        expect(() => new LocalBackend({storageId})).toThrow("storageId must be a non-empty string.");
    }
});
