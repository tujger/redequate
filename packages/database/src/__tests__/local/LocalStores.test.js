import {vi} from "vitest";
import {IDBFactory, IDBDatabase, IDBObjectStore} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {getAllRecords, getRecordsByType, openDatabase} from "../../local/helpers";
import {indexesForStore, LOCAL_COLLECTIONS, STORE_SCHEMA} from "../../local/constants";

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

it("creates physical stores, indexes and per-store allocators at schema version two", async () => {
    const open = vi.spyOn(indexedDB, "open");
    const database = await openDatabase("schema");
    try {
        expect(open).toHaveBeenCalledExactlyOnceWith("redequate:local:schema", 2);
        expect(database.version).toBe(2);
        expect([...database.objectStoreNames]).toEqual(Object.keys(LOCAL_COLLECTIONS)
            .flatMap(name => [name, `${name}__keys`]).sort());
        for (const obsolete of ["records", "follow", "watch", "followstamps", "watchstamps",
            "_developers", "_game_scores", "_genres", "_main_counters", "_posts",
            "_platforms", "_publishers", "_stat"]) {
            expect(database.objectStoreNames.contains(obsolete)).toBe(false);
        }
        for (const name of Object.keys(LOCAL_COLLECTIONS)) {
            const store = database.transaction(name).objectStore(name);
            expect(store.keyPath).toEqual(STORE_SCHEMA.keyPath);
            expect([...store.indexNames]).toEqual(Object.keys(indexesForStore(name)).sort());
            for (const [index, keyPath] of Object.entries(indexesForStore(name))) expect(store.index(index).keyPath).toEqual(keyPath);
            const allocator = database.transaction(`${name}__keys`).objectStore(`${name}__keys`);
            expect(allocator.autoIncrement).toBe(true);
            expect(allocator.keyPath).toBeNull();
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
    expect([...writes[0][0]].sort()).toEqual(["posts", "replies", "users_public"]);
    expect((await getAllRecords("batch-stores")).map(row => row._collection).sort()).toEqual(["posts", "replies", "users_public"]);
    for (const collection of ["posts", "replies", "users_public"]) {
        const rows = await storedRows("batch-stores", LOCAL_COLLECTIONS[collection].store);
        expect(rows).toHaveLength(1);
        expect(rows[0]._collection).toBe(collection);
    }
    expect((await storedRows("batch-stores", "users_public")).map(row => row._collection)).toEqual(["users_public"]);
    await database.update({"posts/p1/text": "updated", "replies/p1/text": "updated"});
    expect(await database.read([...record("posts"), "text"])).toBe("updated");
    expect(await database.read([...record("replies"), "text"])).toBe("updated");
});

it("rolls back all stores and sends no notification if a queued write fails", async () => {
    const database = new LocalDatabase({storageKey: "abort-stores"});
    await database.update(record("posts"), () => ({text: "original"}));
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
        expect(seen).toEqual(["posts", "users_public", "replies"]);
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
        expect(postChanged).toHaveBeenLastCalledWith({p: {text: "post"}});
        expect(replyChanged).toHaveBeenLastCalledWith({r: {text: "reply"}});
        expect(await getRecordsByType("indexed", [{type: "replies"}, "kind"])).toEqual([
            {id: "r", value: {text: "reply"}}
        ]);
        await database.update([{type: "replies"}, {kind: "r", _: 0}, "text"], () => "changed");
        expect(await database.read(["replies", {kind: "r", _: 0}, "text"])).toBe("changed");
    } finally { handles.forEach(handle => handle.remove()); }
});

it.each([2, 3])("rejects an incompatible version-%i database", async version => {
    const name = `legacy-${version}`;
    const request = indexedDB.open(`redequate:local:${name}`, version);
    request.onupgradeneeded = () => {
        request.result.createObjectStore("records", {keyPath: STORE_SCHEMA.keyPath});
    };
    const old = await new Promise(resolve => {request.onsuccess = () => resolve(request.result);});
    old.close();
    await expect(openDatabase(name)).rejects.toMatchObject({name: "VersionError"});
});
