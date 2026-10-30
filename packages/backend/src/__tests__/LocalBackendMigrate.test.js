import {IDBFactory, IDBDatabase} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import createLocalDatabase, {readNativeStore} from "../../../database/src/__tests__/createLocalDatabase";
import {openLocalDatabase} from "../../../common/src/localDatabase";
import {observeWrites} from "../local/database/callable/createHelpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const options = {collection: "activity", sourceField: "activity_uid", targetField: "activity_id"};
const seed = async (storageId, rows, collection = "activity") => {
    const database = createLocalDatabase({storageId});
    await database.read([collection]);
    const native = await openLocalDatabase(storageId);
    try {
        await new Promise((resolve, reject) => {
            const transaction = native.transaction(collection, "readwrite");
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
            rows.forEach(row => transaction.objectStore(collection).add(row));
        });
    } finally { native.close(); }
    return database;
};
const migrate = (storageId = "migration", input = options) => new LocalBackend({storageId}).request("database.migrate", input);

it("repairs old keys, keeps all data and lets the original cursor read the result", async () => {
    const rows = [{activity_uid: "old", uid: "u", details: {text: "keep"}},
        {activity_id: "current", activity_uid: "different", type: "existing"}, {activity_uid: "null-key", activity_id: null}];
    const database = await seed("migration", rows);
    await expect(database.cursor(["activity", "activity_id"]).next(10)).rejects.toThrow("Record has no activity_id");
    const before = await readNativeStore("migration", "activity");
    await expect(migrate()).resolves.toEqual({scanned: 3, repaired: 2, unchanged: 1});
    expect(await readNativeStore("migration", "activity")).toEqual(before.map(row =>
        row.activity_id == null ? {...row, activity_id: row.activity_uid} : row));
    expect((await database.cursor(["activity", "activity_id"]).next(10)).map(item => item.key).sort()).toEqual(["current", "null-key", "old"]);
    await expect(migrate()).resolves.toEqual({scanned: 3, repaired: 0, unchanged: 3});
});

it("works with another collection and field pair and isolates storageId", async () => {
    await seed("one", [{legacy_key: "p1", title: "keep"}], "posts");
    await seed("two", [{legacy_key: "p2"}], "posts");
    await migrate("one", {collection: "posts", sourceField: "legacy_key", targetField: "post_id"});
    expect((await readNativeStore("one", "posts"))[0]).toMatchObject({legacy_key: "p1", post_id: "p1", title: "keep"});
    expect((await readNativeStore("two", "posts"))[0]).not.toHaveProperty("post_id");
});

it.each([
    [{activity_uid: "first"}, {}],
    [{activity_uid: "first"}, {activity_uid: ""}],
    [{activity_uid: "first"}, {activity_uid: "first"}],
    [{activity_uid: "first"}, {activity_id: "first"}],
])("rolls back invalid or conflicting rows %j and closes its connection", async (...rows) => {
    await seed("migration", rows);
    const before = await readNativeStore("migration", "activity");
    const close = vi.spyOn(IDBDatabase.prototype, "close");
    await expect(migrate()).rejects.toThrow("_id=");
    expect(close).toHaveBeenCalled();
    expect(await readNativeStore("migration", "activity")).toEqual(before);
});

it("notifies only after a successful commit, and not on repeat or failure", async () => {
    await seed("migration", [{activity_uid: "a"}]);
    const observed = [];
    const stop = observeWrites("migration", async collection => {
        observed.push([collection, (await readNativeStore("migration", collection))[0].activity_id]);
    });
    try {
        await migrate(); await migrate();
        expect(observed).toEqual([["activity", "a"]]);
    } finally { stop(); }
});

it.each([
    {sourceField: "_id"}, {targetField: "_id"}, {targetField: "activity_uid"},
    {targetField: "nested.key"}, {targetField: "__proto__"}, {collection: "missing"},
    {targetField: "uid"}, {sourceField: ""},
])("rejects invalid configuration %j without changing data", async changes => {
    await seed("migration", [{activity_uid: "a"}]);
    const before = await readNativeStore("migration", "activity");
    await expect(migrate("migration", {...options, ...changes})).rejects.toThrow();
    expect(await readNativeStore("migration", "activity")).toEqual(before);
});
it("handles an empty collection", async () => {
    await seed("migration", []);
    await expect(migrate()).resolves.toEqual({scanned: 0, repaired: 0, unchanged: 0});
});

const addOldIndex = async storageId => {
    const connection = await openLocalDatabase(storageId);
    const version = connection.version; connection.close();
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(storageId, version + 1);
        request.onupgradeneeded = () => request.transaction.objectStore("activity").createIndex("activity_uid", "activity_uid", {unique: true});
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { request.result.close(); resolve(); };
    });
};
const indexNames = async storageId => {
    const connection = await openLocalDatabase(storageId);
    try { return [...connection.transaction("activity").objectStore("activity").indexNames]; }
    finally { connection.close(); }
};
it("removes the obsolete source index while preserving declared indexes", async () => {
    await seed("migration", [{activity_uid: "old", uid: "user"}]);
    await addOldIndex("migration");
    await migrate();
    expect(await indexNames("migration")).toEqual(["activity_id", "type", "uid"]);
    expect((await readNativeStore("migration", "activity"))[0]).toMatchObject({activity_uid: "old", activity_id: "old"});
});
it("retains an index for a source field declared in the current schema", async () => {
    await seed("migration", [{uid: "user"}]);
    await migrate("migration", {...options, sourceField: "uid"});
    expect(await indexNames("migration")).toContain("uid");
});
it("rolls back the schema upgrade as well as data when migration fails", async () => {
    await seed("migration", [{activity_uid: "old"}, {}]);
    await addOldIndex("migration");
    await expect(migrate()).rejects.toThrow("_id=");
    expect(await indexNames("migration")).toContain("activity_uid");
    expect((await readNativeStore("migration", "activity"))[0]).not.toHaveProperty("activity_id");
});
