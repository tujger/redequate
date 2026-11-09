import createService from "../../../../src/__tests__/createService";
import {IDBFactory} from "fake-indexeddb";
import PostListener from "../common/handlers/posts";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";

const params = {post_id: "deleted"};
const path = (id, name) => ["_counters", {id}, {[name]: name}];
const setup = () => {
    const counters = new Map(); const deleted = []; const images = [];
    const backend = {getCurrentUser: vi.fn().mockResolvedValue(undefined), storage: {delete: vi.fn(async url => { images.push(url); })}, request: vi.fn(async (name, target, value, options) => {
        if (name === "database.read") return value?.shallow ? [] : target[0] === "posts" ? {child: {to: "deleted"}} : null;
        if (name === "database.create" || target === "") return;
        if (name === "database.delete") { deleted.push(target); return null; }
        if (options.mode === "read") return {value: counters.get(JSON.stringify(target)) ?? 3, etag: "initial"};
        counters.set(JSON.stringify(target), value); return {committed: true, value};
    })};
    return {backend, listener: new PostListener(backend), counters, deleted, images};
};
it("decrements the author's posts then total, deletes children, then images", async () => {
    const {backend, listener, counters, deleted, images} = setup();
    await listener.onDelete({params, value: {uid: "author", images: ["one", "two"]}});
    expect([...counters]).toEqual([[JSON.stringify(["_counters", {id: "author"}, "posts"]), 2], [JSON.stringify(["_counters", {id: "total"}, "posts"]), 2]]);
    expect(backend.request.mock.calls.filter(([name, target]) => (name === "database.read" || name === "database.delete") && target[0] === "posts")).toEqual([
        ["database.read", ["posts"], {orderBy: "to", equalTo: "deleted"}],
        ["database.delete", ["posts", {post_id: "child"}]],
    ]);
    expect(deleted).toEqual([["posts", {post_id: "child"}]]); expect(images).toEqual(["one", "two"]);
});
it("decrements reply and root counters without modifying top-level or user replied counts", async () => {
    const {listener, counters} = setup();
    await listener.onDelete({params, value: {uid: "author", to: "parent", root: "root"}});
    expect([...counters]).toEqual([[JSON.stringify(["_counters", {id: "author"}, "replies"]), 2], [JSON.stringify(["_counters", {id: "root"}, "replied"]), 2]]);
});
it("warns about a missing root and continues deleting children", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const {listener, counters, deleted} = setup();
    await listener.onDelete({params, value: {uid: "author", to: "missing"}});
    expect(warn).toHaveBeenCalledWith("[Post] reply has no root, skipping root counter", "missing");
    expect(counters.size).toBe(1); expect(deleted).toHaveLength(1);
});
it("validates post id before touching data", async () => {
    const {listener, backend} = setup();
    await expect(listener.onDelete({params: {}, value: {uid: "author"}})).rejects.toThrow("id is not defined");
    expect(backend.request).not.toHaveBeenCalled();
});
it.each(["counter-read", "counter-write", "children-read", "child-delete"])("propagates %s failure before deleting images", async stage => {
    const {listener, backend, images} = setup();
    const invoke = backend.request.getMockImplementation();
    const error = new Error("database failed");
    backend.request.mockImplementation((name, target, value, options) => {
        let fails = name === "database.delete";
        if (stage === "counter-read") fails = options?.mode === "read";
        if (stage === "counter-write") fails = options?.mode === "replace";
        if (stage === "children-read") fails = name === "database.read" && target[0] === "posts";
        return fails ? Promise.reject(error) : invoke(name, target, value, options);
    });
    await expect(listener.onDelete({params, value: {uid: "author", images: ["one"]}})).rejects.toBe(error);
    expect(images).toEqual([]);
});
it("logs an image failure and still attempts all other images", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const {listener, backend, images} = setup();
    const error = new Error("storage failed");
    const remove = backend.storage.delete.getMockImplementation();
    backend.storage.delete.mockImplementation(url => url === "bad" ? Promise.reject(error) : remove(url));
    await listener.onDelete({params, value: {uid: "author", images: [null, "bad", "good"]}});
    expect(log).toHaveBeenCalledWith(error); expect(images).toEqual(["good"]);
});
it("cascades through LocalBackend and leaves an unrelated branch intact", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storage = {delete: vi.fn().mockResolvedValue(undefined)};
        const storageId = "post-delete-chain";
        const backend = createService(LocalBackend, {storageId, storage});
        const database = createService(LocalDatabase, {storageId, backend});
        await database.read(["posts"]);
        const post = id => ["posts", {post_id: id}];
        await database.create(post("root"), {uid: "a", text: "root", images: ["root-image"]});
        await vi.waitFor(async () => expect(await backend.request("database.read", path("total", "posts"))).toBe(1));
        await database.create(post("parent"), {uid: "b", to: "root", images: ["parent-image"]});
        await vi.waitFor(async () => expect(await backend.request("database.read", path("root", "replied"))).toBe(1));
        await database.create(post("child"), {uid: "c", to: "parent", images: ["child-image"]});
        await vi.waitFor(async () => expect(await backend.request("database.read", path("root", "replied"))).toBe(2));
        await database.create(post("unrelated"), {uid: "d", text: "keep", images: ["keep-image"]});
        await vi.waitFor(async () => expect(await backend.request("database.read", path("total", "posts"))).toBe(2));
        await database.delete(post("root"));
        await vi.waitFor(async () => {
            expect(await database.read(["posts", "post_id"])).toEqual({unrelated: {uid: "d", text: "keep", images: ["keep-image"]}});
            expect(await backend.request("database.read", path("total", "posts"))).toBe(1);
            expect(await backend.request("database.read", path("b", "replies"))).toBeNull();
            expect(await backend.request("database.read", path("c", "replies"))).toBeNull();
            expect(storage.delete.mock.calls.map(([url]) => url).sort()).toEqual(["child-image", "parent-image", "root-image"]);
        });
    } finally { vi.unstubAllGlobals(); }
});
