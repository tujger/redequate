import createLocalDatabase from "../createLocalDatabase";
import {IDBFactory, IDBObjectStore} from "fake-indexeddb";
import {vi} from "vitest";


beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("generates ordered unique keys across nested collections and stores", async () => {
    const db = createLocalDatabase({storageId: "sequences"});
    const post = await db.create(["posts", "post_id"], {text: "first"});
    const nested = await db.create(["posts", {post_id: post}, "edits", "id"], {text: "edit"});
    const other = await db.create(["posts", "comments", "id"], {text: "comment"});
    const metadata = await db.create(["meta", "post_id"], {text: "reply"});
    const keys = [post, nested, other, metadata];
    expect(keys.every(key => /^[-0-9A-Z_a-z]{20}$/.test(key))).toBe(true);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(4);
    expect(await db.read(["posts", {post_id: post}])).toMatchObject({text: "first"});
    expect(await db.read(["posts", {post_id: post}, "edits", {id: nested}])).toMatchObject({text: "edit"});
    expect(await db.read(["posts", "comments", {id: other}])).toMatchObject({text: "comment"});
});

it("prepares callbacks before saving and rolls back failed record writes", async () => {
    const db = createLocalDatabase({storageId: "rollback"});
    const error = new Error("callback failed");
    await expect(db.create(["meta", "id"], key => {
        expect(key).toMatch(/^[-0-9A-Z_a-z]{20}$/);
        throw error;
    })).rejects.toBe(error);
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (...args) {
        if (this.name === "meta") throw new Error("write failed");
        return put.apply(this, args);
    });
    await expect(db.create(["meta", "id"], {name: "lost"})).rejects.toThrow("write failed");
    vi.restoreAllMocks();
    const key = await db.create(["meta", "id"], key => ({name: key}));
    expect(key).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(await db.read(["meta", {id: key}])).toEqual({name: key});
    await expect(db.create(["meta", {id: key}], {name: "duplicate"})).rejects.toMatchObject({name: "ConstraintError"});
    expect(await db.create(["meta", {id: "10"}], {name: "supplied"})).toBe("10");
    expect(await db.create(["meta", "id"], {name: "next"})).toMatch(/^[-0-9A-Z_a-z]{20}$/);
});

it("serializes concurrent creates and reports callback errors through onError", async () => {
    const onError = vi.fn();
    const db = createLocalDatabase({storageId: "concurrent", onError});
    const keys = await Promise.all(Array.from({length: 12}, (_, index) =>
        db.create(["meta", "id"], key => ({index, key}))));
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(12);
    for (const key of keys) expect(await db.read(["meta", {id: key}])).toMatchObject({key});
    const error = new Error("callback failed");
    expect(await db.create(["meta", "id"], () => { throw error; })).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "create", {
        path: ["meta", "id"], value: expect.any(Function)
    });
    const after = await db.create(["meta", "id"], {after: true});
    expect(after > keys.at(-1)).toBe(true);
});

it("runs supplied-key callbacks before the request and leaves duplicates untouched", async () => {
    const db = createLocalDatabase({storageId: "supplied-callback"});
    const callback = vi.fn(key => ({key}));
    expect(await db.create(["meta", {id: "manual"}], callback)).toBe("manual");
    expect(callback).toHaveBeenCalledExactlyOnceWith("manual");
    callback.mockClear();
    await expect(db.create(["meta", {id: "manual"}], callback)).rejects.toMatchObject({name: "ConstraintError"});
    expect(callback).toHaveBeenCalledExactlyOnceWith("manual");
    expect(await db.read(["meta", {id: "manual"}])).toEqual({key: "manual"});
});

it("preserves existing numeric identities when generating string keys", async () => {
    const db = createLocalDatabase({storageId: "existing-numeric"});
    await db.update(["meta", {id: "1"}], () => ({name: "existing"}));
    expect(await db.create(["meta", "id"], {name: "generated"})).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(await db.read(["meta", {id: "1"}])).toEqual({name: "existing"});
});

it("rejects an incompatible version-one database without migrating it", async () => {
    const request = globalThis.indexedDB.open("upgrade-keys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("meta", {keyPath: ["_collection", "_key"]});
    const connection = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    await new Promise((resolve, reject) => {
        const transaction = connection.transaction("meta", "readwrite");
        transaction.objectStore("meta").put({_collection: "meta", _key: JSON.stringify([["fixed", "id", "7"]]), value: {name: "old"}});
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
    });
    connection.close();
    const db = createLocalDatabase({storageId: "upgrade-keys"});
    await expect(db.create(["meta", "id"], {name: "new"})).rejects.toMatchObject({name: "VersionError"});
});

it("filters by explicit timestamp through pages, including missing timestamps", async () => {
    const db = createLocalDatabase({storageId: "dates"});
    for (const [id, timestamp, score] of [["a", 2000, 2], ["b", undefined, 0],
        ["c", 1000, 1], ["d", 2000, 3], ["e", 3000, 4]]) {
        await db.update(["meta", {id}], () => ({score, ...(timestamp === undefined ? {} : {timestamp})}));
    }
    for (const [options, expected] of [
        [{startDate: new Date(2000), endDate: new Date(2000)}, ["a", "d"]],
        [{orderBy: "score", startDate: new Date(2000), endDate: new Date(3000)}, ["a", "d", "e"]],
        [{orderBy: "timestamp", order: "desc", startDate: new Date(1000), endDate: new Date(2000)}, ["d", "a", "c"]]
    ]) {
        const cursor = db.cursor("meta", options);
        const keys = [];
        for (let page = 0; !cursor.position.finished && page < 20; page++) {
            keys.push(...(await cursor.next(1)).map(entry => entry.key));
        }
        expect(keys).toEqual(expected);
        expect(cursor.position.finished).toBe(true);
    }
});

it("keeps key ordering across deletion and preserves equal supplied IDs in different paths", async () => {
    const db = createLocalDatabase({storageId: "native-sequence"});
    const other = createLocalDatabase({storageId: "native-sequence"});
    await db.update(new Map([
        [["meta", "first", {id: "7"}], {label: "root"}],
        [["meta", "second", {id: "7"}], {label: "nested"}]
    ]));
    expect(await db.read(["meta", "first", {id: "7"}])).toEqual({label: "root"});
    expect(await db.read(["meta", "second", {id: "7"}])).toEqual({label: "nested"});
    const first = await db.create(["meta", "id"], {label: "generated"});
    await db.delete(["meta", {id: first}]);
    const second = await other.create(["meta", "id"], {label: "next"});
    expect(second > first).toBe(true);
    expect(await other.read(["meta", {id: second}])).toEqual({label: "next"});
});
