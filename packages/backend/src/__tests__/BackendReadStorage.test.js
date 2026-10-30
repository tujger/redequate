import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local";
import LocalDatabase from "../../../database/src/local";
import FirebaseServerBackend from "../firebase-server/src/database/FirebaseServerBackend";
import adminStorage from "../firebase-server/src/storage";

// Query tests isolate storage operations from application reactions.
vi.mock("../common", () => ({handlers: {}}));

it("filters Local records by to while retaining unfiltered reads", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storageId = "read-query"; const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId, backend});
        await database.read(["posts"]);
        for (const [post_id, to] of [["a", "parent"], ["b", "elsewhere"], ["c", "parent"]]) {
            await backend.request("database.create", ["posts", {post_id}], {to});
        }
        expect(await backend.request("database.read", ["posts"], {orderBy: "to", equalTo: "parent"})).toEqual({a: {to: "parent"}, c: {to: "parent"}});
        expect(Object.keys(await backend.request("database.read", ["posts"]))).toEqual(["a", "b", "c"]);
        expect(await backend.request("database.read", ["posts"], {orderBy: "to", equalTo: "absent"})).toBeNull();
    } finally { vi.unstubAllGlobals(); }
});
it("uses Firebase's indexed query and fixes direct database deletion", async () => {
    const query = {get: vi.fn().mockResolvedValue({val: () => ({child: {to: "parent"}})}), remove: vi.fn(),
        orderByChild: vi.fn(function () { return this; }), equalTo: vi.fn(function () { return this; })};
    const database = {ref: vi.fn(() => query)};
    const backend = new FirebaseServerBackend(() => database);
    expect(await backend.request("database.read", ["posts"], {orderBy: "to", equalTo: "parent"})).toEqual({child: {to: "parent"}});
    expect(query.orderByChild).toHaveBeenCalledWith("to"); expect(query.equalTo).toHaveBeenCalledWith("parent");
    await backend.request("database.delete", ["posts", {post_id: "child"}]);
    expect(database.ref).toHaveBeenLastCalledWith("posts/child"); expect(query.remove).toHaveBeenCalledOnce();
});
it.each([null, [], {limit: 10}])("rejects unsupported read options %j", async options => {
    const backend = new FirebaseServerBackend(() => ({ref: vi.fn()}));
    await expect(backend.request("database.read", ["posts"], options)).rejects.toMatchObject({code: "database/invalid-argument"});
});
it("delegates storage deletion to the supplied provider in both backends", async () => {
    const storage = {delete: vi.fn().mockResolvedValue("deleted")};
    for (const backend of [new LocalBackend({storage}), new FirebaseServerBackend(undefined, undefined, {storage})]) {
        expect(await backend.request("storage.delete", "https://files.test/one")).toBe("deleted");
    }
    expect(storage.delete).toHaveBeenCalledTimes(2);
    await expect(new LocalBackend().request("storage.delete", "one")).rejects.toMatchObject({code: "backend/not-configured"});
});
it("deletes only the exact Admin Storage object and rejects foreign buckets", async () => {
    const bucket = {name: "own-bucket", file: vi.fn(() => ({delete: vi.fn().mockResolvedValue(undefined)}))};
    const storage = adminStorage(() => ({bucket: () => bucket}));
    for (const input of ["images/one.jpg", "gs://own-bucket/images/one.jpg", "https://firebasestorage.googleapis.com/v0/b/own-bucket/o/images%2Fone.jpg?token=secret"]) {
        await storage.delete(input);
        expect(bucket.file).toHaveBeenLastCalledWith("images/one.jpg");
    }
    await expect(storage.delete("gs://other-bucket/one")).rejects.toMatchObject({code: "storage/invalid-argument"});
    expect(bucket.file).toHaveBeenCalledTimes(3);
});
