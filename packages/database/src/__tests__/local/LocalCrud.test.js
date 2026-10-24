import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("creates records, uses final keys in callbacks, and rejects duplicate IDs", async () => {
    const database = new LocalDatabase({storageKey: "crud-create"});
    const generatedKey = await database.create(["posts", "post_id"], key => ({key}));
    expect(generatedKey).toBe("1");
    expect(await database.read(["posts", {post_id: generatedKey}])).toMatchObject({key: generatedKey});
    expect(await database.create(["posts", {post_id: "p1"}], key => ({key}))).toBe("p1");
    await expect(database.create(["posts", {post_id: "p1"}], {key: "changed"})).rejects.toMatchObject({name: "ConstraintError"});
    expect(await database.read(["posts", {post_id: "p1"}])).toMatchObject({key: "p1"});
    await expect(database.create(["posts", "post_id"], async () => ({})))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});

it("merges, atomically replaces and deletes values, rejects asynchronous callbacks and preserves batches", async () => {
    const database = new LocalDatabase({storageKey: "crud-update"});
    const path = ["posts", {post_id: "p1"}];
    await database.update(path, {name: "A"});
    await database.update(path, {retained: true});
    expect(await database.read(path)).toMatchObject({name: "A", retained: true});
    expect(await database.update(path, () => ({name: "B"}))).toMatchObject({name: "B"});
    expect(await database.read(path)).not.toHaveProperty("retained");
    const missing = ["posts", {post_id: "p2"}];
    expect(await database.update(missing, () => ({name: "new"}))).toMatchObject({name: "new"});
    const error = new Error("rollback");
    await expect(database.update(path, () => { throw error; })).rejects.toBe(error);
    await expect(database.update(path, async () => ({}))).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(path)).toMatchObject({name: "B"});
    await database.update(new Map([[[...path, "name"], "C"], [[...missing, "name"], "D"]]));
    expect(await database.read([...path, {name: "name"}])).toBe("C");
    expect(await database.update(path, () => undefined)).toBeNull();
    expect(await database.read(path)).toBeUndefined();
    expect(await database.update(missing, () => null)).toBeNull();
    expect(await database.read(missing)).toBeUndefined();
    expect(database.write).toBeUndefined();
});
