import {vi} from "vitest";
import {IDBFactory, IDBDatabase, IDBObjectStore} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {getAllRecords, getRecordsByType, openDatabase, parseDatabasePath} from "../../local/helpers";
import {DEFAULT_STORE, LOCAL_COLLECTIONS, STORE_SCHEMA} from "../../local/constants";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const record = (collection, id = "p1") => [collection, {post_id: id}];
const storedRows = async (storageKey, name) => {
    const database = await openDatabase(storageKey);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(name);
            const request = transaction.objectStore(name).getAll();
            transaction.oncomplete = () => resolve(request.result);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { database.close(); }
};

it("creates the configured stores and indexes without specifying a database version", async () => {
    const open = vi.spyOn(indexedDB, "open");
    const database = await openDatabase("schema");
    try {
        expect(open).toHaveBeenCalledExactlyOnceWith("redequate:local:schema");
        expect(database.version).toBe(1);
        expect([...database.objectStoreNames]).toEqual([DEFAULT_STORE, ...Object.values(LOCAL_COLLECTIONS).map(config => config.store)].sort());
        for (const name of database.objectStoreNames) {
            const store = database.transaction(name).objectStore(name);
            expect(store.keyPath).toEqual(STORE_SCHEMA.keyPath);
            expect([...store.indexNames]).toEqual(Object.keys(STORE_SCHEMA.indexes).sort());
            for (const [index, keyPath] of Object.entries(STORE_SCHEMA.indexes)) expect(store.index(index).keyPath).toEqual(keyPath);
        }
    } finally { database.close(); }
});



it("uses one transaction to write records, posts and replies and aggregates their rows", async () => {
    const database = new LocalDatabase({storageKey: "batch-stores"});
    const transaction = vi.spyOn(IDBDatabase.prototype, "transaction");
    await database.update(new Map([
        [record("posts"), {text: "post"}],
        [record("replies"), {text: "reply"}],
        [["users_public", {user_id: "u1"}], {name: "user"}]
    ]));
    const writes = transaction.mock.calls.filter(([, mode]) => mode === "readwrite");
    expect(writes).toHaveLength(1);
    expect([...writes[0][0]].sort()).toEqual(["posts", "records", "replies"]);
    expect((await getAllRecords("batch-stores")).map(row => row._collection).sort()).toEqual(["posts", "replies", "users_public"]);
    for (const collection of Object.keys(LOCAL_COLLECTIONS)) {
        const rows = await storedRows("batch-stores", LOCAL_COLLECTIONS[collection].store);
        expect(rows).toHaveLength(1);
        expect(rows[0]._collection).toBe(collection);
    }
    expect((await storedRows("batch-stores", DEFAULT_STORE)).map(row => row._collection)).toEqual(["users_public"]);
    await database.update({"posts/p1/text": "updated", "replies/p1/text": "updated"});
    expect(await database.read([...record("posts"), "text"])).toBe("updated");
    expect(await database.read([...record("replies"), "text"])).toBe("updated");
});

it("rolls back all stores and sends no notification if a queued write fails", async () => {
    const database = new LocalDatabase({storageKey: "abort-stores"});
    await database.write(record("posts"), {text: "original"});
    const onChange = vi.fn();
    const listener = database.addEventListener(record("posts"), {onChange});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
        const put = IDBObjectStore.prototype.put;
        const seen = [];
        vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (...args) {
            seen.push(this.name);
            if (this.name === "replies") throw new Error("write failed");
            return put.apply(this, args);
        });
        await expect(database.update(new Map([
            [record("posts"), {text: "changed"}],
            [["users_public", {user_id: "u1"}], {name: "new"}],
            [record("replies"), {text: "new"}]
        ]))).rejects.toThrow("write failed");
        expect(seen).toEqual(["posts", "records", "replies"]);
        expect(await database.read(record("posts"))).toMatchObject({text: "original"});
        expect(await database.read(record("replies"))).toBeUndefined();
        expect(await database.read(["users_public", {user_id: "u1"}])).toBeUndefined();
        expect(onChange).toHaveBeenCalledOnce();
    } finally { listener.remove(); }
});

it("reads type indexes and notifies collection listeners from the dedicated stores", async () => {
    const database = new LocalDatabase({storageKey: "indexed"});
    const postChanged = vi.fn(), replyChanged = vi.fn();
    const handles = [database.addEventListener([{type: "posts"}], {onChange: postChanged}),
        database.addEventListener(["replies"], {onChange: replyChanged})];
    try {
        await vi.waitFor(() => expect(replyChanged).toHaveBeenCalledOnce());
        await database.update(new Map([
            [[{type: "posts"}, {kind: "p", _: 0}], {text: "post"}],
            [["replies", {kind: "r", _: 0}], {text: "reply"}]
        ]));
        expect(postChanged).toHaveBeenLastCalledWith({p: {text: "post", timestamp: expect.any(Number)}});
        expect(replyChanged).toHaveBeenLastCalledWith({r: {text: "reply", timestamp: expect.any(Number)}});
        expect(await getRecordsByType("indexed", [{type: "replies"}, "kind"])).toEqual([
            {id: "r", value: {text: "reply", timestamp: expect.any(Number)}}
        ]);
        await database.update([{type: "replies"}, {kind: "r", _: 0}, "text"], () => "changed");
        expect(await database.read(["replies", {kind: "r", _: 0}, "text"])).toBe("changed");
    } finally { handles.forEach(handle => handle.remove()); }
});

it.each([1, 2])("keeps an existing version-%i database unchanged without exposing legacy dedicated rows", async version => {
    const name = `legacy-${version}`;
    const request = indexedDB.open(`redequate:local:${name}`, version);
    request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("records", {keyPath: STORE_SCHEMA.keyPath});
        for (const collection of ["posts", "replies", "users_public"]) {
            const path = parseDatabasePath(record(collection));
            store.put({_collection: collection, _key: path.key, _conditions: {}, value: {text: "legacy"}});
        }
    };
    const old = await new Promise(resolve => {request.onsuccess = () => resolve(request.result);});
    old.close();
    const database = await openDatabase(name);
    expect(database.version).toBe(version);
    expect([...database.objectStoreNames]).toEqual(["records"]);
    database.close();
    const local = new LocalDatabase({storageKey: name});
    expect((await getAllRecords(name)).map(row => row._collection)).toEqual(["users_public"]);
    expect(await local.read(record("users_public"))).toEqual({text: "legacy"});
    await expect(local.read(record("posts"))).rejects.toMatchObject({name: "NotFoundError"});
    expect(await storedRows(name, "records")).toHaveLength(3);
});
