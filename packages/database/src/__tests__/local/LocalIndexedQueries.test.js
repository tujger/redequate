import createLocalDatabase from "../createLocalDatabase";
import {vi} from "vitest";
import {IDBFactory, IDBIndex, IDBObjectStore} from "fake-indexeddb";


beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const collect = async (cursor, size = 1) => {
    const entries = [];
    while (!cursor.position.finished) entries.push(...await cursor.next(size));
    return entries;
};

it("uses an existing field index for bounded reads and cursor pages", async () => {
    const db = createLocalDatabase({storageId: "indexed-field"});
    for (const [id, name] of [["10", "Bob"], ["2", "Amy"], ["02", "Amy"], ["x", "Zoe"]]) {
        await db.update(["users_public", {user_id: id}], () => ({name}));
    }
    const index = vi.spyOn(IDBIndex.prototype, "getAll");
    const store = vi.spyOn(IDBObjectStore.prototype, "getAll");
    expect(await db.read(["users_public", "user_id"], {orderBy: "name", equalTo: "Amy"}))
        .toEqual({2: expect.objectContaining({name: "Amy"}), "02": expect.objectContaining({name: "Amy"})});
    expect(await db.read(["users_public"], {orderBy: "name", equalTo: "Bob"}))
        .toEqual({10: expect.objectContaining({name: "Bob"})});
    expect((await collect(db.cursor(["users_public"], {orderBy: "name", equalTo: "Bob"}))).map(entry => entry.key))
        .toEqual(["10"]);
    expect((await collect(db.cursor(["users_public", "user_id"], {
        orderBy: "name", start: "Amy", end: "Bob", order: "desc"
    }))).map(entry => entry.key)).toEqual(["10", "02", "2"]);
    expect(index).toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
});

it("uses a compound index within a fixed scope and hydrates nested records", async () => {
    const db = createLocalDatabase({storageId: "indexed-scope"});
    const path = ["chats", {chat_id: "room"}];
    await db.update([...path, {message_id: "a"}], () => ({created: 1}));
    await db.update([...path, {message_id: "b"}], () => ({created: 2}));
    await db.update(["chats", {chat_id: "other"}, {message_id: "c"}], () => ({created: 2}));
    await db.update([...path, {message_id: "b"}, "edit", {id: "e1"}], () => ({text: "nested"}));
    const index = vi.spyOn(IDBIndex.prototype, "getAll");
    expect((await collect(db.cursor([...path, "message_id"], {orderBy: "created", equalTo: 2}))))
        .toMatchObject([{key: "b", value: {edit: {e1: {text: "nested"}}}}]);
    expect(index).toHaveBeenCalled();
});

it("falls back for scalar role values and bounds that can include unindexed values", async () => {
    const db = createLocalDatabase({storageId: "fallback"});
    await db.update(["roles", {user_id: "u1"}], () => "admin");
    await db.update(["roles", {user_id: "u2"}], () => "member");
    const index = vi.spyOn(IDBIndex.prototype, "getAll");
    const store = vi.spyOn(IDBObjectStore.prototype, "getAll");
    expect((await collect(db.cursor(["roles", "user_id"], {equalTo: "admin"}))))
        .toEqual([{key: "u1", value: "admin"}]);
    expect(await db.read(["roles", "user_id"], {equalTo: "admin"})).toEqual({u1: "admin"});
    expect(store).toHaveBeenCalled();
    expect(index).not.toHaveBeenCalled();
});

it("falls back when an open range includes object values omitted by IndexedDB", async () => {
    const db = createLocalDatabase({storageId: "open-range"});
    await db.update(["users_public", {user_id: "a"}], () => ({name: "Amy"}));
    await db.update(["users_public", {user_id: "b"}], () => ({name: {first: "Bob"}}));
    const index = vi.spyOn(IDBIndex.prototype, "getAll");
    expect(await db.read(["users_public", "user_id"], {orderBy: "name", start: "A"}))
        .toEqual({a: expect.any(Object), b: expect.any(Object)});
    expect(index).not.toHaveBeenCalled();
});
