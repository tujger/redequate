import {IDBFactory} from "fake-indexeddb";
import createService from "../../../../src/__tests__/createService";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import LocalCursor from "../../../database/src/local/cursor";

vi.mock("../common", () => ({handlers: {}}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const setup = async () => {
    const backend = new LocalBackend({storageId: "cursor-all"});
    const database = createService(LocalDatabase, {storageId: "cursor-all", backend});
    await database.read(["posts"]);
    for (const post_id of ["a", "b", "c"]) {
        await database.create(["posts", {post_id}], {text: post_id});
    }
    const cursor = options => backend.request("database.cursor", ["posts", "post_id"], {id: "all-posts", ...options});
    return {backend, database, cursor};
};

it("reads ready without writing and commits multi-page changes with status", async () => {
    const {backend, database, cursor} = await setup();
    const first = await cursor({handle: ({key, value}) => key === "a" ? undefined
        : key === "b" ? null : {...value, text: "replaced"}});
    const request = vi.spyOn(backend, "request");
    expect(await first.status()).toEqual({checkpoint: null, count: 0, startedAt: null,
        updatedAt: null, finishedAt: null, state: "ready"});
    expect(request.mock.calls.some(([name]) => name === "database.update")).toBe(false);
    expect(await first.all(1)).toBe(3);
    expect(await database.read(["posts", {post_id: "a"}])).toEqual({post_id: "a", text: "a"});
    expect(await database.read(["posts", {post_id: "b"}])).toBeUndefined();
    expect(await database.read(["posts", {post_id: "c"}])).toEqual({post_id: "c", text: "replaced"});
    const status = await first.status();
    expect(status).toMatchObject({count: 3, state: "ready", checkpoint: {key: "c", finished: true}});
    expect(status.startedAt).toEqual(expect.any(Number));
    expect(status.updatedAt).toBeGreaterThanOrEqual(status.startedAt);
    expect(status.finishedAt).toBeGreaterThanOrEqual(status.startedAt);
    const batches = request.mock.calls.filter(([name]) => name === "database.update");
    expect(batches.every(([, path, changes]) => path === "" && changes instanceof Map &&
        [...changes.keys()].some(key => Array.isArray(key) && key[0] === "meta"))).toBe(true);
    expect(batches.flatMap(([, , changes]) => [...changes.keys()])).toContainEqual(["posts", {post_id: "b"}]);
});

it("supports explicit checkpoint and null, and restarts after completion", async () => {
    const {database, cursor} = await setup();
    const first = await cursor();
    expect(await first.all(2, null)).toBe(3);
    expect(await first.next(1)).toEqual([]);
    await expect(first.all(2, null)).rejects.toMatchObject({code: "database/invalid-argument"});
    const checkpoint = {index: 0, key: "a", finished: false};
    expect(await (await cursor()).all(1, checkpoint)).toBe(2);
    expect(await (await cursor()).all(2)).toBe(3);
    expect(await (await cursor()).all(2, null)).toBe(3);
    expect(await database.read(["posts", {post_id: "a"}])).toBeDefined();
    const ordinary = await cursor();
    expect((await ordinary.next(1)).map(({key}) => key)).toEqual(["a"]);
});

it("uses this.next and consumes the current cursor without creating a fresh cursor", async () => {
    const {backend, database, cursor} = await setup();
    const current = new LocalCursor(["posts", "post_id"], {id: "all-posts"},
        {backend, database, context: "cursor-all"});
    const next = vi.spyOn(current, "next");
    expect(current._freshCursor).toBeUndefined();
    expect((await current.next(1)).map(({key}) => key)).toEqual(["a"]);
    const checkpoint = current.position;
    expect(await current.all(1, checkpoint)).toBe(2);
    expect(next).toHaveBeenCalledTimes(4);
    expect(current.position).toMatchObject({index: 2, key: "c", finished: true});
    expect(await current.next()).toEqual([]);
    expect(await (await cursor()).all(2, null)).toBe(3);
});

it("rejects a checkpoint behind an already consumed cursor", async () => {
    const {backend, database} = await setup();
    const current = new LocalCursor(["posts", "post_id"], {id: "all-posts"},
        {backend, database, context: "cursor-all"});
    await current.next(1);
    await expect(current.all(1, null)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect((await current.next(1)).map(({key}) => key)).toEqual(["b"]);
    expect(await current.all(1)).toBe(1);
    expect(current.position).toMatchObject({index: 2, key: "c", finished: true});
});

it("records a handle failure without hiding it and rejects invalid sizes", async () => {
    const {cursor} = await setup();
    const error = new Error("broken handle");
    const failed = await cursor({handle: () => { throw error; }});
    await expect(failed.all(1)).rejects.toBe(error);
    expect(await failed.status()).toMatchObject({state: "failed", count: 0,
        checkpoint: null, error: {code: "database/unknown", message: "broken handle"}});
    await expect(failed.all(0)).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("does not apply changes from a page whose handler fails", async () => {
    const {database, cursor} = await setup();
    const error = new Error("stop at b");
    const failed = await cursor({handle: ({key, value}) => {
        if (key === "b") throw error;
        return {...value, text: "changed"};
    }});
    await expect(failed.all(2)).rejects.toBe(error);
    expect(await database.read(["posts", {post_id: "a"}])).toEqual({post_id: "a", text: "a"});
    expect(await failed.status()).toMatchObject({state: "failed", count: 0, checkpoint: null});
});

it("rejects a changed checkpoint before applying the page batch", async () => {
    const {backend, database, cursor} = await setup();
    const external = {checkpoint: {index: 0, key: "external", finished: false}, count: 1,
        startedAt: 1, updatedAt: 1, finishedAt: null, state: "running"};
    const running = await cursor({handle: async ({value}) => {
        await backend.request("database.update", "", new Map([[["meta", {setting: "cursor:all-posts"}], external]]));
        return {...value, text: "changed"};
    }});
    await expect(running.all(1)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(["posts", {post_id: "a"}])).toEqual({post_id: "a", text: "a"});
    expect(await running.status()).toMatchObject(external);
});

it("resumes a failed multi-page run from its committed checkpoint", async () => {
    const {cursor} = await setup();
    const error = new Error("stop at b");
    let running;
    const first = await cursor({handle: async ({key}) => {
        if (key === "b") {
            running = await first.status();
            throw error;
        }
    }});
    await expect(first.all(1)).rejects.toBe(error);
    expect(running).toMatchObject({state: "running", count: 1, checkpoint: {key: "a"}});
    expect(await first.status()).toMatchObject({state: "failed", count: 1, checkpoint: {key: "a"}});
    expect(await (await cursor()).all(1)).toBe(3);
    expect(await first.status()).toMatchObject({state: "ready", count: 3,
        checkpoint: {key: "c", finished: true}});
});

it("finishes an empty cursor and persists its initial position", async () => {
    const {backend} = await setup();
    const empty = await backend.request("database.cursor", ["posts", "post_id"], {
        id: "empty-posts", equalTo: "absent"
    });
    expect(await empty.all()).toBe(0);
    expect(await empty.status()).toMatchObject({state: "ready", count: 0,
        checkpoint: {index: -1, key: undefined, finished: true}});
});

it("exposes all/status on a single source and rejects zero or multiple sources", async () => {
    const {backend} = await setup();
    const single = await backend.request("database.cursor", [{path: ["posts", "post_id"]}]);
    expect(await single.status()).toMatchObject({state: "ready", count: 0});
    expect(await single.all(2, null)).toBe(3);
    for (const sources of [[null], [{path: ["posts", "post_id"]}, {path: ["posts", "post_id"]}]]) {
        const cursor = await backend.request("database.cursor", sources);
        await expect(cursor.all()).rejects.toMatchObject({code: "database/invalid-argument"});
        await expect(cursor.status()).rejects.toMatchObject({code: "database/invalid-argument"});
    }
});
