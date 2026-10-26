import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import FirebaseDatabase from "../../firebase";
import LocalDatabase from "../../local";
import {createFirebase} from "../fixtures/firebase";

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const path = ["_counters", {post_id: "p1"}, "like"];

it("runs Firebase updates as transactions and returns the final snapshot, including cancellation", async () => {
    const fixture = createFirebase();
    const database = new FirebaseDatabase({firebase: fixture.firebase});
    const callback = vi.fn(value => (value ?? 0) + 1);
    fixture.sdk.transaction.mockImplementation(async (ref, update) => {
        expect(ref.path).toBe("_counters/p1/like");
        expect(update(null)).toBe(1);
        expect(update(3)).toBe(4);
        return {committed: true, snapshot: fixture.snapshot(4)};
    });
    expect(await database.update(path, callback)).toBe(4);
    expect(callback.mock.calls).toEqual([[null], [3]]);
    expect(fixture.sdk.transaction.mock.calls[0].slice(2)).toEqual([{applyLocally: false}]);
    expect(fixture.sdk.update).not.toHaveBeenCalled();
    fixture.sdk.transaction.mockImplementation(async (ref, update) => {
        expect(update(4)).toBeNull();
        return {committed: true, snapshot: fixture.snapshot(null)};
    });
    fixture.sdk.once.mockResolvedValue(fixture.snapshot(4));
    expect(await database.update(path, () => undefined)).toBeNull();
});

it("rejects Firebase async callbacks and reports callback errors through the operation boundary", async () => {
    const fixture = createFirebase();
    const database = new FirebaseDatabase({firebase: fixture.firebase});
    fixture.sdk.transaction.mockImplementation(async (ref, update) => {
        const value = update(null);
        return {committed: true, snapshot: fixture.snapshot(value)};
    });
    await expect(database.update(path, async () => 1)).rejects.toMatchObject({code: "database/invalid-argument"});
    const error = new Error("callback failed"), onError = vi.fn();
    await expect(database.update(path, () => { throw error; })).rejects.toBe(error);
    await expect(database.update(path, () => { throw error; }, {onError})).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "update", {path, changes: expect.any(Function)});
});

it("updates Local scalar fields atomically across concurrent calls and returns the committed value", async () => {
    const database = new LocalDatabase({storageId: "update"});
    const other = new LocalDatabase({storageId: "update"});
    const results = await Promise.all(Array.from({length: 20}, (_, index) =>
        (index % 2 ? database : other).update(path, value => (value ?? 0) + 1)));
    expect(results).toEqual(Array.from({length: 20}, (_, index) => index + 1));
    expect(await database.read([...path.slice(0, -1), {like: "like"}])).toBe(20);
    expect(await database.update(path, () => undefined)).toBeNull();
    expect(await database.read([...path.slice(0, -1), {like: "like"}])).toBeUndefined();
    await database.update(path, () => 20);
    expect(await database.update(path, () => null)).toBeNull();
    expect(await database.read([...path.slice(0, -1), {like: "like"}])).toBeUndefined();
});

it("replaces Local records, preserves falsy values and rolls back callback failures", async () => {
    const database = new LocalDatabase({storageId: "records"});
    const record = ["posts", {post_id: "p1"}];
    await database.update(record, () => ({obsolete: true, count: 1}));
    expect(await database.update(record, value => ({count: value.count + 1}))).toEqual({count: 2});
    expect(await database.read(record)).not.toHaveProperty("obsolete");
    const before = await database.read(record);
    expect(await database.update(record, value => { value.count = 99; })).toBeNull();
    expect(await database.read(record)).toBeUndefined();
    await database.update(record, () => before);
    await expect(database.update(record, () => { throw new Error("failed"); })).rejects.toThrow("failed");
    await expect(database.update(record, async () => ({count: 99}))).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(record)).toEqual(before);
    for (const value of [false, 0, ""]) expect(await database.update(record, () => value)).toBe(value);
    expect(await database.update(record, () => null)).toBeNull();
    expect(await database.read(record)).toBeUndefined();
});

it("replaces Local collection subtrees atomically and removes descendant records", async () => {
    const database = new LocalDatabase({storageId: "subtrees"});
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
    expect(await database.read(["posts", {id: "p2"}])).toMatchObject({text: "old!"});
    await expect(database.update(["posts"], () => 1)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(["posts"])).toEqual(result);
});


