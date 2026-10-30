import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import ComposedDatabaseCursor from "../../../database/src/common/ComposedDatabaseCursor";
import {flushIndexedDB} from "../../../auth/src/__tests__/fixtures/indexedDB";

// Cursor tests isolate database operations from application reactions.
vi.mock("../common", () => ({handlers: {}}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const setup = async (storageId = "backend-cursor") => {
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["posts"]);
    return {backend, database};
};
const path = ["posts", "post_id"];
it("returns a live composed cursor with sequential pages and position", async () => {
    const {backend, database} = await setup();
    for (const [post_id, to] of [["a", 3], ["b", 1], ["c", 2]]) {
        await database.create(["posts", {post_id}], {to});
    }
    const cursor = await backend.request("database.cursor", path, {orderBy: "to"});
    expect(cursor).toBeInstanceOf(ComposedDatabaseCursor);
    expect((await cursor.next(1)).map(({key}) => key)).toEqual(["b"]);
    expect((await cursor.next(2)).map(({key}) => key)).toEqual(["c", "a"]);
    expect(cursor.count).toBe(3);
    expect(cursor.position).toMatchObject({index: 2, key: "a"});
    expect(await cursor.next(1)).toEqual([]);
    expect(cursor.position.finished).toBe(true);
});
it("supports filters and keeps storageId scopes independent", async () => {
    const first = await setup("first"), second = await setup("second");
    await first.database.create(["posts", {post_id: "a"}], {to: "parent"});
    await first.database.create(["posts", {post_id: "b"}], {to: "other"});
    await second.database.create(["posts", {post_id: "c"}], {to: "parent"});
    const options = {orderBy: "to", equalTo: "parent", order: "desc"};
    const a = await first.backend.request("database.cursor", path, options);
    const b = await second.backend.request("database.cursor", path, options);
    expect(await a.next(10)).toEqual([{key: "a", value: {to: "parent"}}]);
    expect(await b.next(10)).toEqual([{key: "c", value: {to: "parent"}}]);
    const empty = await first.backend.request("database.cursor", path, {...options, equalTo: "missing"});
    expect(await empty.next(10)).toEqual([]); expect(empty.position.finished).toBe(true);
});
it("uses the current backend to persist handle replacements and deletions", async () => {
    const {backend, database} = await setup();
    for (const post_id of ["a", "b"]) await database.create(["posts", {post_id}], {text: post_id});
    const request = vi.spyOn(backend, "request");
    const cursor = await backend.request("database.cursor", path, {
        handle: ({key, value}) => key === "a" ? null : {...value, text: "changed"},
    });
    expect(await cursor.next(10)).toEqual([{key: "b", value: {text: "changed"}}]);
    expect(await database.read(["posts", {post_id: "a"}])).toBeUndefined();
    expect(await database.read(["posts", {post_id: "b"}])).toEqual({text: "changed"});
    expect(request.mock.calls.filter(([name]) => name === "database.update")).toHaveLength(4);
});
it("delivers live subscription events and stops after unsubscribe", async () => {
    const {backend, database} = await setup();
    const cursor = await backend.request("database.cursor", path, {orderBy: "to", start: 2});
    const events = [];
    const subscription = cursor.subscribe(event => events.push(event));
    try {
        await flushIndexedDB();
        await database.create(["posts", {post_id: "a"}], {to: 1});
        expect(events).toEqual([]);
        await database.update(["posts", {post_id: "a"}], {to: 2});
        expect(events).toEqual([{type: "add", entry: {key: "a", value: {to: 2}}}]);
        subscription.unsubscribe();
        await database.update(["posts", {post_id: "a"}], {to: 3});
        expect(events).toHaveLength(1);
    } finally { subscription.unsubscribe(); }
});
it.each([
    [], [path, {}, true], [null], [["posts", ""]], [path, null], [path, []],
    [path, {order: "invalid"}], [path, {handle: true}], [path, {equalTo: 1, start: 0}],
])("rejects invalid command arguments %j", async (...args) => {
    const {backend} = await setup();
    await expect(backend.request("database.cursor", ...args)).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("composes query descriptions and fresh cursors with pagination and deduplication", async () => {
    const {backend, database} = await setup();
    for (const [post_id, to] of [["a", 1], ["b", 1], ["c", 2]]) {
        await database.create(["posts", {post_id}], {to});
    }
    const first = await backend.request("database.cursor", path, {orderBy: "to", equalTo: 1});
    const cursor = await backend.request("database.cursor", [first,
        {path, orderBy: "to", start: 1}]);
    expect((await cursor.next(2)).map(row => row.key)).toEqual(["a", "b"]);
    expect((await cursor.next(2)).map(row => row.key)).toEqual(["c"]);
    expect(cursor.position.finished).toBe(true);
    expect(cursor.count).toBe(3);
    expect((await backend.request("database.cursor", path)).path).toBe("posts");
});

it("supports empty compositions and rejects invalid or reused sources", async () => {
    const {backend} = await setup();
    // null is an ignored source, making this an unambiguous empty composition.
    const empty = await backend.request("database.cursor", [null]);
    expect(await empty.next(10)).toEqual([]);
    expect(empty.position.finished).toBe(true);
    const fresh = await backend.request("database.cursor", ["posts", "post_id"]);
    for (const sources of [[Promise.resolve(fresh)], [fresh, fresh], [{path: null}]]) {
        await expect(backend.request("database.cursor", sources))
            .rejects.toMatchObject({code: "database/invalid-argument"});
    }
    await fresh.next(1);
    await expect(backend.request("database.cursor", [fresh]))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});
it("propagates composition validation errors even with onError", async () => {
    const {backend} = await setup();
    const onError = vi.fn();
    await expect(backend.request("database.cursor", [{path: null}], {onError}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(onError).not.toHaveBeenCalled();
});

it("keeps single-source composition paging equivalent to a single-path request", async () => {
    const {backend, database} = await setup();
    for (const post_id of ["a", "b", "c"]) {
        await database.create(["posts", {post_id}], {to: 1});
    }
    const single = await backend.request("database.cursor", path);
    const composed = await backend.request("database.cursor", [{path}]);
    for (const size of [1, 2, 1]) {
        expect(await composed.next(size)).toEqual(await single.next(size));
        expect(composed.position).toEqual(single.position);
        expect(composed.count).toBe(single.count);
    }
});
