import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import createLocalDatabase, {readNativeStore} from "../createLocalDatabase";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const path = ["posts", {post_id: "p1"}];
const snapshot = (value, etag = "initial") => ({value, etag});
const commit = value => ({committed: true, value});
const client = () => {
    const backend = {request: vi.fn()};
    return {backend, database: new LocalDatabase({backend})};
};

it("merges in Database and sends a complete replacement without opening IndexedDB", async () => {
    const {backend, database} = client();
    const open = vi.fn(() => { throw new Error("update must not open IndexedDB"); });
    vi.stubGlobal("indexedDB", {open});
    backend.request.mockResolvedValueOnce(snapshot({keep: true, nested: {old: 1}, obsolete: true}))
        .mockResolvedValueOnce(commit({keep: true, nested: {next: 2}}));
    expect(await database.update(path, {nested: {next: 2}, obsolete: null})).toBeUndefined();
    expect(backend.request.mock.calls).toEqual([
        ["database.update", path, null, {mode: "read"}],
        ["database.update", path, {keep: true, nested: {next: 2}}, {mode: "replace", etag: "initial"}]
    ]);
    expect(open).not.toHaveBeenCalled();
});

it("replaces supplied collection children and preserves other siblings", async () => {
    const {backend, database} = client();
    backend.request.mockResolvedValueOnce(snapshot({p1: {a: 1, b: 2}, p2: {keep: true}, p3: false}, "initial"))
        .mockResolvedValueOnce(commit({}));
    await database.update(["posts"], {p1: {a: 3}, p3: null, p4: "new"});
    expect(backend.request.mock.calls[1]).toEqual([
        "database.update", ["posts"], {p1: {a: 3}, p2: {keep: true}, p4: "new"},
        {mode: "replace", etag: "initial"}
    ]);
});

it("reapplies object merge to the freshest snapshot after a conflict", async () => {
    const {backend, database} = client();
    vi.spyOn(Math, "random").mockReturnValue(0);
    backend.request.mockResolvedValueOnce(snapshot({keep: 1}))
        .mockResolvedValueOnce({committed: false, ...snapshot({keep: 2, concurrent: true}, "fresh")})
        .mockResolvedValueOnce(commit({}));
    await database.update(path, {added: true});
    expect(backend.request.mock.calls[1][2]).toEqual({keep: 1, added: true});
    expect(backend.request.mock.calls[2]).toEqual([
        "database.update", path, {keep: 2, concurrent: true, added: true}, {mode: "replace", etag: "fresh"}
    ]);
});

it("reapplies collection replacement to the freshest siblings after a conflict", async () => {
    const {backend, database} = client();
    vi.spyOn(Math, "random").mockReturnValue(0);
    backend.request.mockResolvedValueOnce(snapshot({p1: {a: 1, b: 2}}, "initial"))
        .mockResolvedValueOnce({committed: false, ...snapshot({p1: {a: 1, b: 4}, p2: false}, "fresh")})
        .mockResolvedValueOnce(commit({}));
    await database.update(["posts"], {p1: {a: 3}});
    expect(backend.request.mock.calls[2][2]).toEqual({p1: {a: 3}, p2: false});
});

it("executes callbacks before replace requests and returns the committed value", async () => {
    const {backend, database} = client();
    vi.spyOn(Math, "random").mockReturnValue(0);
    backend.request.mockResolvedValueOnce(snapshot({obsolete: true, count: 1}))
        .mockResolvedValueOnce({committed: false, ...snapshot({other: true, count: 3}, "fresh")})
        .mockResolvedValueOnce(commit({count: 4}));
    const callback = vi.fn(value => ({count: value.count + 1}));
    expect(await database.update(path, callback)).toEqual({count: 4});
    expect(callback.mock.calls).toEqual([[{obsolete: true, count: 1}], [{other: true, count: 3}]]);
    expect(backend.request.mock.calls[1][2]).toEqual({count: 2});
    expect(backend.request.mock.calls[2][2]).toEqual({count: 4});
});

it.each([undefined, null, false, 0, "", [1, 2]])("sends callback result %j as a complete replacement", async value => {
    const {backend, database} = client();
    backend.request.mockResolvedValueOnce(snapshot({old: true})).mockResolvedValueOnce(commit(value ?? null));
    expect(await database.update(path, () => value)).toEqual(value ?? null);
    expect(backend.request.mock.calls[1][2]).toEqual(value ?? null);
});

it("rejects async and throwing callbacks after reading, without requesting replacement", async () => {
    const {backend, database} = client();
    backend.request.mockResolvedValue(snapshot({count: 1}));
    await expect(database.update(path, async () => ({count: 2}))).rejects.toMatchObject({code: "database/invalid-argument"});
    const failure = new Error("callback failed");
    await expect(database.update(path, () => { throw failure; })).rejects.toBe(failure);
    expect(backend.request.mock.calls.every(call => call[3].mode === "read")).toBe(true);
});

it("sends named batch paths as one root request and keeps backend failure handling", async () => {
    const {backend, database} = client();
    const updates = new Map([[path, {title: "complete"}], [["roles", {user_id: "u"}], null]]);
    backend.request.mockResolvedValue(null);
    expect(await database.update(updates)).toBeUndefined();
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", "", updates);
    backend.request.mockClear();
    await database.update({"posts/p1/title": "new"});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", "", new Map([["posts/p1/title", "new"]]));
    const failure = new Error("backend failed"), onError = vi.fn();
    backend.request.mockRejectedValueOnce(failure);
    expect(await database.update(updates, {onError})).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure, "update", {updates});
});

it("rejects invalid inputs before requests and never constructs a fallback backend", async () => {
    const {backend, database} = client();
    const callback = vi.fn();
    for (const [target, changes] of [[null, undefined], [path, false], [path, []], [path, null], [path, undefined],
        [new Map([[path, callback]]), undefined], ["", callback]]) {
        await expect(database.update(target, changes)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(callback).not.toHaveBeenCalled();
    expect(backend.request).not.toHaveBeenCalled();
    await expect(new LocalDatabase().update(path, {})).rejects.toBeInstanceOf(TypeError);
});

it("reports a conflict after 25 attempts through the existing error boundary", async () => {
    const {backend, database} = client();
    vi.spyOn(Math, "random").mockReturnValue(0);
    backend.request.mockResolvedValueOnce(snapshot(0));
    backend.request.mockImplementation(async () => ({committed: false, ...snapshot(1, "conflict")}));
    const callback = vi.fn(value => value + 1), onError = vi.fn();
    expect(await database.update(path, callback, {onError})).toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(25);
    expect(backend.request).toHaveBeenCalledTimes(26);
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "database/conflict"}), "update", {path, changes: callback});
});

it("uses Firebase collection semantics, shallow record merges and full callback replacements on real Local storage", async () => {
    const database = createLocalDatabase({storageId: "delegated-merge"});
    await database.read(["posts"]);
    await database.update(new Map([[path, {a: 1, b: 2, nested: {old: true}}], [["posts", {post_id: "p2"}], {keep: true}]]));
    await database.update(["posts"], {p1: {a: 3}});
    expect(await database.read(path)).toEqual({a: 3});
    expect(await database.read(["posts", {post_id: "p2"}])).toEqual({keep: true});
    await database.update(path, {nested: {next: true}, b: null});
    expect(await database.read(path)).toEqual({a: 3, nested: {next: true}});
    expect(await database.update(path, () => ({final: true}))).toEqual({final: true});
    expect(await database.read(path)).toEqual({final: true});
});

it("preserves concurrent updates from independent Database instances without lost fields", async () => {
    const database = createLocalDatabase({storageId: "delegated-concurrent"});
    const other = createLocalDatabase({storageId: "delegated-concurrent"});
    await database.read(["posts"]);
    await database.update(path, {count: 0});
    await Promise.all([database.update(path, {one: true}), other.update(path, {two: true})]);
    expect(await database.read(path)).toEqual({count: 0, one: true, two: true});
    const values = await Promise.all(Array.from({length: 6}, (_, index) =>
        (index % 2 ? database : other).update([...path, {field: "count"}], value => value + 1)));
    expect(values.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect((await database.read(path)).count).toBe(6);
});

it("requires separately prepared stores and performs no implicit schema initialization", async () => {
    const database = createLocalDatabase({storageId: "unprepared-update"});
    await expect(database.update(path, {title: "A"})).rejects.toMatchObject({name: "NotFoundError"});
    await database.read(["posts"]);
    await database.update(path, {title: "A"});
    expect(await database.read(path)).toEqual({title: "A"});
});

it("keeps native keys and resolves collection marker fields against previous child values", async () => {
    const database = createLocalDatabase({storageId: "delegated-collection-markers"});
    await database.read(["posts"]);
    await database.update(new Map([[path, {count: 5, keep: true}], [["posts", {post_id: "p2"}], {other: true}]]));
    const before = await readNativeStore("delegated-collection-markers", "posts");
    await database.update(["posts"], {p1: {count: database.increment(2), time: database.TIMESTAMP}});
    expect(await database.read(path)).toEqual({count: 7, time: expect.any(Number)});
    const after = await readNativeStore("delegated-collection-markers", "posts");
    expect(after.map(row => [row.post_id, row._id])).toEqual(before.map(row => [row.post_id, row._id]));
    const counter = await database.update([...path, {count: "count"}], value => value + 1);
    expect(counter).toBe(8);
});

it("replaces Local collection subtrees atomically and removes descendant records", async () => {
    const database = createLocalDatabase({storageId: "subtrees"});
    await database.read(["posts"]);
    const record = ["posts", {post_id: "p1"}];
    const child = [...record, "edit", {edit_id: "e1"}];
    await database.update(record, () => ({text: "old"}));
    await database.update(child, () => ({uid: "u1"}));
    const callback = vi.fn(value => ({text: value.text + "!"}));
    expect(await database.update(record, callback)).toMatchObject({text: "old!"});
    expect(callback.mock.calls[0][0]).toMatchObject({edit: {e1: {uid: "u1"}}});
    expect(await database.read(child)).toBeUndefined();
    const result = await database.update(["posts"], value => ({p2: {text: value.p1.text}}));
    expect(result).toMatchObject({p2: {text: "old!"}});
    expect(await database.read(record)).toBeUndefined();
    expect(await database.read(["posts", {post_id: "p2"}])).toMatchObject({text: "old!"});
    await expect(database.update(["posts"], () => 1)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(["posts"])).toEqual(result);
});
