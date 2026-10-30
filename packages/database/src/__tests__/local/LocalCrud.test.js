import {IDBFactory, IDBDatabase} from "fake-indexeddb";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local/LocalBackend";
import {openDatabase} from "../../local/helpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const setup = async (storageId = "native", stores) => {
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, stores, backend});
    await database.read(["posts"]);
    return {database, backend};
};
const raw = async (storageId, name) => {
    const database = await openDatabase(storageId);
    try {
        const store = database.transaction(name).objectStore(name);
        const indexes = [...store.indexNames];
        const rows = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return {rows, indexes};
    } finally { database.close(); }
};

it("keeps physical fields inside Local and queries the schema's unique index", async () => {
    const {database} = await setup();
    expect(await database.create(["posts", {post_id: "p1"}], {title: "A"})).toBe("p1");
    const value = await database.read(["posts", {post_id: "p1"}]);
    expect(value).toEqual({title: "A"});
    expect(await raw("native", "posts")).toEqual({
        indexes: ["post_id", "to", "uid"], rows: [{...value, _id: 1, post_id: "p1"}]
    });
    await expect(database.create(["posts", {post_id: "p1"}], {title: "B"})).rejects.toMatchObject({name: "ConstraintError"});
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual(value);
    await expect(database.create(["posts", {post_id: "p2"}], {post_id: "different"})).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("uses composite indexes for scoped queries without leaking identity fields", async () => {
    const {database} = await setup();
    for (const [chat_id, message_id] of [["c1", "m1"], ["c1", "m2"], ["c2", "m1"]]) {
        await database.create(["chats", {chat_id}, {message_id}], {text: message_id});
    }
    expect(await database.read(["chats", {chat_id: "c1"}, "message_id"])).toEqual({
        m1: {text: "m1"},
        m2: {text: "m2"}
    });
    await database.update(["chats", {chat_id: "c1"}, {message_id: "m1"}], {text: "changed"});
    expect((await database.read(["chats", {chat_id: "c2"}, {message_id: "m1"}])).text).toBe("m1");
});

it("keeps nested properties inside their parent object", async () => {
    const {database} = await setup();
    await database.create(["posts", {post_id: "p1"}], {title: "A", edits: {e1: {text: "old"}}});
    await database.update(["posts", {post_id: "p1"}, "edits", {edit_id: "e1"}], () => ({text: "new"}));
    await database.create(["posts", {post_id: "p1"}, "edits", {edit_id: "e2"}], {text: "second"});
    expect(await database.read(["posts", {post_id: "p1"}, {edits: "edits"}, {edit_id: "e1"}])).toEqual({text: "new"});
    const {rows} = await raw("native", "posts");
    expect(rows).toHaveLength(1);
    expect(rows[0].edits).toEqual({e1: {text: "new"}, e2: {text: "second"}});
    await database.delete(["posts", {post_id: "p1"}, "edits", {edit_id: "e1"}]);
    expect((await database.read(["posts", {post_id: "p1"}])).edits).toEqual({e2: {text: "second"}});
});

it("stores one small document in unindexed stores and updates properties without record lookup", async () => {
    const {database} = await setup();
    await database.update(new Map([
        [["meta", "settings"], {theme: "dark"}],
        [["meta", "maintenance"], false],
        [["meta", "support"], "user-1"]
    ]));
    expect(await database.read(["meta", {settings: "settings"}])).toEqual({theme: "dark"});
    expect(await database.read(["meta", "maintenance"])).toBe(false);
    await database.update(["meta", "settings"], {locale: "en"});
    const stored = await raw("native", "meta");
    expect(stored.indexes).toEqual([]);
    const document = {settings: {theme: "dark", locale: "en"}, maintenance: false, support: "user-1"};
    expect(stored.rows).toEqual([{...document, _id: 1}]);
    await database.delete(["meta", "maintenance"]);
    expect(await database.read(["meta", "maintenance"])).toBeUndefined();
    await expect(database.read(["meta"], {orderBy: "settings"})).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("rejects undeclared searches instead of introducing fallback indexes", async () => {
    const {database} = await setup();
    await database.create(["posts", {post_id: "p1"}], {title: "A"});
    await expect(database.read(["posts", {title: "A"}])).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.read(["posts"], {orderBy: "title"})).rejects.toMatchObject({code: "database/invalid-argument"});
    expect((await raw("native", "posts")).indexes).toEqual(["post_id", "to", "uid"]);
});

it("rolls back callbacks and cross-store batches atomically", async () => {
    const {database} = await setup();
    await database.update(["posts", {post_id: "p1"}], {title: "A"});
    const failure = new Error("failed");
    await expect(database.update(["posts", {post_id: "p1"}], () => { throw failure; })).rejects.toBe(failure);
    await expect(database.update(["posts", {post_id: "p1"}], async () => ({}))).rejects.toMatchObject({code: "database/invalid-argument"});
    await database.create(["users_public", {user_id: "u1"}], {name: "same"});
    await expect(database.update(new Map([
        [["posts", {post_id: "p1"}], {title: "changed"}],
        [["users_public", {user_id: "u2"}], {user_id: "u1"}]
    ]))).rejects.toMatchObject({code: "database/invalid-argument"});
    expect((await database.read(["posts", {post_id: "p1"}])).title).toBe("A");
    await expect(database.update(new Map([
        [["posts", {post_id: "p1"}], {}], [["posts", {post_id: "p1"}, "title"], "B"]
    ]))).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("resolves prepared numbers and timestamp markers before encoding the record", async () => {
    const {database, backend} = await setup();
    const path = ["posts", {post_id: "p1"}];
    await database.create(path, {count: 2});
    await database.update(path, {count: backend.increment(3), timestamp: database.TIMESTAMP});
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual({count: 5, timestamp: expect.any(Number)});
});

it("uses native primary keys when explicitly addressing a record", async () => {
    const {database} = await setup();
    await database.create(["posts", {post_id: "p1"}], {});
    expect(await database.read(["posts", {_id: "1"}])).toEqual({});
    await database.update(["posts", {_id: "1"}], {title: "native"});
    expect((await database.read(["posts", {post_id: "p1"}])).title).toBe("native");
});

it("closes connections on commit and on missing-store errors", async () => {
    await setup();
    const close = vi.spyOn(IDBDatabase.prototype, "close");
    const backend = new LocalBackend({storageId: "native"});
    await backend.request("database.create", ["posts", {post_id: "p1"}], {});
    expect(close).toHaveBeenCalledTimes(1);
    await expect(backend.request("database.create", ["missing", {id: "x"}], {})).rejects.toMatchObject({name: "NotFoundError"});
    expect(close).toHaveBeenCalledTimes(2);
});

// Keep storage checks independent of asynchronous application reactions.
vi.mock("../../../../backend/src/common", () => ({handlers: {}}));
