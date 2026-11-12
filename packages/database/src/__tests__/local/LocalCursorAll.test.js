import {IDBFactory} from "fake-indexeddb";
import {vi} from "vitest";
import createService from "../../../../../src/__tests__/createService";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local/LocalBackend";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const setup = async observe => {
    const storageId = `cursor-all-${Math.random()}`;
    const backend = new LocalBackend({storageId});
    if (observe) {
        const request = backend.request.bind(backend);
        backend.request = async (...args) => {
            await observe(...args);
            return request(...args);
        };
    }
    const database = createService(LocalDatabase, {storageId, backend});
    await database.read(["posts"]);
    return database;
};

it("commits replacements, deletes and cumulative checkpoints by ordered page", async () => {
    const database = await setup();
    for (const [postId, to] of [["a", 2], ["b", 1], ["c", 2]]) {
        await database.create(["posts", {post_id: postId}], {to});
    }
    const seen = [];
    const make = () => database.cursor(["posts", "post_id"], {
        orderBy: "to",
        handle: ({key, value}) => {
            seen.push(key);
            return key === "a" ? null : {...value, done: true};
        }
    });
    expect(await make().all(2)).toBe(3);
    expect(seen).toEqual(["b", "a", "c"]);
    const checkpoint = (await make().status()).checkpoint;
    expect(checkpoint).toMatchObject({key: "c", value: 2, count: 3, finished: true});
    expect(checkpoint.started).toEqual(expect.any(Number));
    expect(checkpoint.timestamp).toEqual(expect.any(Number));
    expect(await database.read(["posts", {post_id: "a"}])).toBeUndefined();
    expect((await database.read(["posts", {post_id: "b"}])).done).toBe(true);
    expect(await make().all(2, checkpoint)).toBe(0);
});

it("awaits an independent page-start checkpoint before handling or writing data", async () => {
    const events = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const database = await setup(async (name, path, value) => {
        if (name !== "database.update" || !(value instanceof Map)) return;
        if ([...value.keys()].some(key => Array.isArray(key) && key[0] === "meta")) {
            events.push("checkpoint");
            if (events.length === 1) await gate;
        } else events.push("data");
    });
    await database.create(["posts", {post_id: "a"}], {to: 1});
    const handle = vi.fn(() => { events.push("handle"); return {to: 2}; });
    const running = database.cursor(["posts", "post_id"], {handle}).all(2);
    await vi.waitFor(() => expect(events).toContain("checkpoint"));
    expect(events).toEqual(["checkpoint"]);
    expect(handle).not.toHaveBeenCalled();
    release();
    expect(await running).toBe(1);
    expect(events.slice(0, 3)).toEqual(["checkpoint", "handle", "data"]);
});

it("rejects a page-start persistence failure without calling the handler", async () => {
    const database = await setup(async (name, path, value) => {
        if (name === "database.update" && value instanceof Map &&
            [...value.keys()].some(key => Array.isArray(key) && key[0] === "meta")) {
            throw new Error("checkpoint failed");
        }
    });
    await database.create(["posts", {post_id: "a"}], {to: 1});
    const handle = vi.fn();
    await expect(database.cursor(["posts", "post_id"], {handle}).all(2)).rejects.toThrow("checkpoint failed");
    expect(handle).not.toHaveBeenCalled();
});

it("replays an inclusive page after data commits but completion checkpoint fails", async () => {
    let checkpointWrites = 0;
    const database = await setup(async (name, path, value) => {
        if (name === "database.update" && value instanceof Map &&
            [...value.keys()].some(key => Array.isArray(key) && key[0] === "meta") &&
            ++checkpointWrites === 2) throw new Error("completion checkpoint failed");
    });
    await database.create(["posts", {post_id: "a"}], {to: 1});
    const original = database.cursor(["posts", "post_id"], {handle: () => ({to: 2})});
    await expect(original.all(2)).rejects.toThrow("completion checkpoint failed");
    expect(await database.read(["posts", {post_id: "a"}])).toEqual({to: 2});
    const checkpoint = (await original.status()).checkpoint;
    expect(checkpoint).toMatchObject({key: "a", count: 1, finished: false,
        error: {message: "completion checkpoint failed"}});
    const seen = [];
    const resumed = database.cursor(["posts", "post_id"], {handle: entry => { seen.push(entry.key); }});
    expect(await resumed.all(2, checkpoint)).toBe(1);
    expect(seen).toEqual(["a"]);
    expect((await resumed.status()).checkpoint).toMatchObject({count: 2, finished: true});
});

it("resumes exclusively at a tied ordered value and retains the last committed page on failure", async () => {
    const database = await setup();
    for (const key of ["a", "b", "c"]) await database.create(["posts", {post_id: key}], {to: 1});
    const first = database.cursor(["posts", "post_id"], {
        orderBy: "to",
        handle: ({key, value}) => {
            if (key === "c") throw new Error("stop");
            return {...value, done: true};
        }
    });
    await expect(first.all(2)).rejects.toThrow("stop");
    const checkpoint = (await database.cursor(["posts", "post_id"]).status()).checkpoint;
    expect(checkpoint).toMatchObject({key: "c", value: 1, count: 2, finished: false, error: {message: "stop"}});
    const seen = [];
    const resumed = database.cursor(["posts", "post_id"], {
        orderBy: "to",
        handle: entry => {
            seen.push(entry.key);
        }
    });
    expect(await resumed.all(2, checkpoint)).toBe(1);
    expect(seen).toEqual(["c"]);
    expect((await resumed.status()).checkpoint).toMatchObject({key: "c", count: 3, finished: true});
});

it("starts afresh without a checkpoint and rejects a composed multi-source cursor", async () => {
    const batches = [];
    const database = await setup((name, path, value) => {
        if (name === "database.update") batches.push(value);
    });
    await database.create(["posts", {post_id: "a"}], {to: 1});
    const cursor = database.cursor(["posts", "post_id"], {handle: ({value}) => ({...value, done: true})});
    expect(await cursor.status()).toEqual({checkpoint: null});
    expect(await cursor.all(1)).toBe(1);
    expect(await database.cursor(["posts", "post_id"]).all(2)).toBe(1);
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.every(batch => batch instanceof Map)).toBe(true);
    expect(batches.some(batch => [...batch.keys()].some(key => Array.isArray(key) && key[0] === "posts"))).toBe(true);
    const composed = database.cursor([{path: ["posts", "post_id"]}, {path: ["posts", "post_id"]}]);
    await expect(composed.all(1)).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(composed.status()).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("rolls back the whole IndexedDB page when a later replacement is invalid", async () => {
    const database = await setup();
    await database.create(["posts", {post_id: "a"}], {to: 1});
    await database.create(["posts", {post_id: "b"}], {to: 2});
    const cursor = database.cursor(["posts", "post_id"], {
        handle: ({key, value}) =>
            key === "a" ? {...value, done: true} : {...value, post_id: "wrong"}
    });
    await expect(cursor.all(2)).rejects.toThrow();
    expect(await database.read(["posts", {post_id: "a"}])).toEqual({to: 1});
    expect((await database.cursor(["posts", "post_id"]).status()).checkpoint).toMatchObject(
        {key: "a", count: 0, finished: false, error: {message: "Record conflicts with path field post_id."}});
});

it("marks an empty selection complete without advancing a key", async () => {
    const database = await setup();
    const cursor = database.cursor(["posts", "post_id"]);
    expect(await cursor.all(3, null)).toBe(0);
    expect((await cursor.status()).checkpoint).toMatchObject({key: null, count: 0, finished: true});
});

it("resumes past a deleted page end and a changed record moved later in sort order", async () => {
    const database = await setup();
    for (const [postId, to] of [["a", 1], ["b", 2], ["c", 3], ["d", 4]]) {
        await database.create(["posts", {post_id: postId}], {to});
    }
    const seen = [];
    const original = database.cursor(["posts", "post_id"], {
        orderBy: "to",
        handle: ({key, value}) => {
            seen.push(key);
            if (key === "c") throw new Error("page failed");
            if (key === "a") return {...value, to: 100};
            if (key === "b") return null;
        }
    });
    await expect(original.all(2)).rejects.toThrow("page failed");
    expect(seen).toEqual(["a", "b", "c"]);
    const failed = (await original.status()).checkpoint;
    expect(failed).toMatchObject({key: "c", value: 3, count: 2, error: {message: "page failed"}});
    expect(await database.read(["posts", {post_id: "b"}])).toBeUndefined();
    const resumed = database.cursor(["posts", "post_id"], {
        orderBy: "to", handle: entry => { seen.push(entry.key); }
    });
    expect(await resumed.all(2, failed)).toBe(3);
    expect(seen).toEqual(["a", "b", "c", "c", "d", "a"]);
    const complete = (await resumed.status()).checkpoint;
    expect(complete).toMatchObject({count: 5, finished: true, started: failed.started});
    expect(complete.error).toBeUndefined();
    expect(complete.timestamp).toBeGreaterThanOrEqual(failed.timestamp);
});

it("records an error on the first page without advancing count, then clears it", async () => {
    const database = await setup();
    await database.create(["posts", {post_id: "a"}], {rank: 1});
    await database.create(["posts", {post_id: "b"}], {rank: 2});
    const error = new Error("middle failed");
    const failing = database.cursor(["posts", "post_id"], {
        handle: ({key}) => { if (key === "b") throw error; return {rank: 100}; }
    });
    await expect(failing.all(2)).rejects.toBe(error);
    expect(await database.read(["posts", {post_id: "a"}])).toEqual({rank: 1});
    const checkpoint = (await failing.status()).checkpoint;
    expect(checkpoint).toMatchObject({key: "a", count: 0, finished: false,
        error: {name: "Error", message: "middle failed"}});
    const resumed = database.cursor(["posts", "post_id"]);
    expect(await resumed.all(2, checkpoint)).toBe(2);
    expect((await resumed.status()).checkpoint).toMatchObject({count: 2, finished: true,
        started: checkpoint.started});
});
