import {IDBFactory, IDBObjectStore} from "fake-indexeddb";
import {vi} from "vitest";
import LocalDatabase from "../../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("shares one numeric sequence across nested collections in a physical store, but isolates stores", async () => {
    const db = new LocalDatabase({storageKey: "sequences"});
    const post = await db.create(["posts", "post_id"]).save({text: "first"});
    const nested = await db.create(["posts", {post_id: post}, "edits", "id"]).save({text: "edit"});
    const other = await db.create(["posts", "comments", "id"]).save({text: "comment"});
    const reply = await db.create(["replies", "post_id"]).save({text: "reply"});
    expect([post, nested, other, reply]).toEqual(["1", "2", "3", "1"]);
    expect(await db.read(["posts", {post_id: post}])).toMatchObject({text: "first"});
    expect(await db.read(["posts", {post_id: post}, "edits", {id: nested}])).toMatchObject({text: "edit"});
    expect(await db.read(["posts", "comments", {id: other}])).toMatchObject({text: "comment"});
});

it("passes the permanent key synchronously to save callback and rolls back allocation on failure", async () => {
    const db = new LocalDatabase({storageKey: "rollback"});
    const error = new Error("callback failed");
    await expect(db.create(["meta", "id"]).save(key => {
        expect(key).toBe("1");
        throw error;
    })).rejects.toBe(error);
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (...args) {
        if (this.name === "meta") throw new Error("write failed");
        return put.apply(this, args);
    });
    await expect(db.create(["meta", "id"]).save({name: "lost"})).rejects.toThrow("write failed");
    vi.restoreAllMocks();
    const draft = db.create(["meta", "id"]);
    expect(draft.temporaryKey).not.toBe("1");
    expect(await draft.save(key => ({name: key}))).toBe("1");
    expect(await db.read(["meta", {id: "1"}])).toEqual({name: "1"});
    await expect(draft.save({name: "duplicate"})).rejects.toMatchObject({name: "ConstraintError"});
    expect(await db.create(["meta", {id: "10"}]).save({name: "supplied"})).toBe("10");
    expect(await db.create(["meta", "id"]).save({name: "next"})).toBe("11");
});

it("skips a numeric identity written outside create", async () => {
    const db = new LocalDatabase({storageKey: "existing-numeric"});
    await db.update(["meta", {id: "1"}], () => ({name: "existing"}));
    expect(await db.create(["meta", "id"]).save({name: "generated"})).toBe("2");
    expect(await db.read(["meta", {id: "1"}])).toEqual({name: "existing"});
});

it("upgrades version-one rows without reusing their numeric identities", async () => {
    const request = globalThis.indexedDB.open("redequate:local:upgrade-keys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("meta", {keyPath: ["_collection", "_key"]});
    const connection = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    await new Promise((resolve, reject) => {
        const transaction = connection.transaction("meta", "readwrite");
        transaction.objectStore("meta").put({_collection: "meta", _key: JSON.stringify([["fixed", "id", "7"]]), value: {name: "old"}});
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
    });
    connection.close();
    const db = new LocalDatabase({storageKey: "upgrade-keys"});
    expect(await db.create(["meta", "id"]).save({name: "new"})).toBe("8");
    expect(await db.read(["meta", {id: "7"}])).toEqual({name: "old"});
});

it("filters by explicit timestamp through pages, including missing timestamps", async () => {
    const db = new LocalDatabase({storageKey: "dates"});
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
