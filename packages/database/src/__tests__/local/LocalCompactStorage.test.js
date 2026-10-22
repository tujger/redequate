import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {LOCAL_SCHEMA} from "../../local/storeSchema";
import stores from "../../local/stores.json";
import {getRecordsByType} from "../../local/helpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const result = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
const rawOpen = (name, version) => result(indexedDB.open(`redequate:local:${name}`, version));
const transactionDone = transaction => new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
});
const record = id => ["meta", {id, _: true}];
const path = id => JSON.stringify([["dynamic", 0, "id", id]]);
const legacyRow = (id, value) => ({...value, _id: id === "a" ? 7 : 8, _local: {
    _collection: "meta", _key: path(id), _key0: "id", _value0: id, id,
    _cursorKey: [1, id], _fields: {old: [3, "text"]}, _unsupportedFields: {}, value
}});
const seedLegacy = async (name, rows) => {
    const request = indexedDB.open(`redequate:local:${name}`, 1);
    request.onupgradeneeded = () => {
        for (const [name, definition] of Object.entries(LOCAL_SCHEMA)) {
            const store = request.result.createObjectStore(name, {keyPath: "_id", autoIncrement: true});
            for (const [index, spec] of Object.entries(definition.indexes)) {
                if (index !== "_identity") store.createIndex(index, spec.keyPath, {unique: spec.unique});
            }
            store.createIndex("_identity", ["_local._collection", "_local._key"], {unique: true});
            store.createIndex("_key0", ["_local._collection", "_local._key0"]);
            store.createIndex("_field:text", ["_local._collection", "_local._fields.old", "_local._cursorKey", "_local._key"]);
            store.createIndex("_unsupported:text", ["_local._collection", "_local._unsupportedFields.old"]);
            store.createIndex("_scopeKey", ["_local._scope", "_local._cursorKey", "_local._key"]);
        }
        request.transaction.objectStore("meta").createIndex("external", "text");
    };
    const connection = await result(request);
    const transaction = connection.transaction("meta", "readwrite");
    const done = transactionDone(transaction);
    rows.forEach(row => transaction.objectStore("meta").put(row));
    await done;
    connection.close();
};

it("creates exactly the JSON indexes plus one path index in every store", async () => {
    await new LocalDatabase({storageKey: "compact-schema"}).read(["meta"]);
    const connection = await rawOpen("compact-schema");
    try {
        let count = 0;
        for (const definition of stores) {
            const store = connection.transaction(definition.store).objectStore(definition.store);
            expect([...store.indexNames].sort()).toEqual([...definition.storeSchema.map(index => index.name), "_identity"].sort());
            expect(store.index("_identity").keyPath).toBe("_local.path");
            expect(store.index("_identity").unique).toBe(true);
            count += store.indexNames.length;
        }
        expect(count).toBe(86);
        expect(connection.version).toBe(1);
    } finally { connection.close(); }
});

it("stores object fields once and preserves scalar, array and colliding values", async () => {
    const db = new LocalDatabase({storageKey: "compact-values"});
    const plain = {text: "hello", details: {nested: [1, 2]}};
    const collisions = JSON.parse('{"_id":"public","_local":{"public":true},"_key":"public","value":"public","__proto__":{"safe":true}}');
    for (const [id, value] of [["a", plain], ["b", collisions], ["c", [1, {a: 2}]], ["d", false], ["e", "text"]]) {
        await db.update(record(id), () => value);
        expect(await db.read(record(id))).toEqual(value);
    }
    const connection = await rawOpen("compact-values");
    try {
        const store = connection.transaction("meta").objectStore("meta");
        const rows = await result(store.getAll());
        expect(rows[0]).toEqual({_id: 1, ...plain, _local: {path: path("a")}});
        expect(rows[1]._local).toEqual({path: path("b"), originals: {_id: "public", _local: {public: true}}});
        expect(rows[1]).not.toHaveProperty("_key0");
        expect(rows[2]._local.value).toEqual([1, {a: 2}]);
    } finally { connection.close(); }
});

it("stores identity projections only for declared indexes and restores conflicting public fields", async () => {
    const db = new LocalDatabase({storageKey: "compact-projection"});
    const address = ["posts", {post_id: "address"}];
    const value = {post_id: "public", text: "hello"};
    await db.update(address, () => value);
    expect(await db.read(address)).toEqual(value);
    const connection = await rawOpen("compact-projection");
    try {
        const row = await result(connection.transaction("posts").objectStore("posts").index("post_id").get("address"));
        expect(row).toEqual({_id: 1, post_id: "address", text: "hello", _local: {
            path: JSON.stringify([["fixed", "post_id", "address"]]), originals: {post_id: "public"}
        }});
    } finally { connection.close(); }
    await db.update(address, () => ({text: "updated"}));
    expect(await db.read(address)).toEqual({text: "updated"});
});

it("compacts legacy rows and removes generated indexes in one version bump without deleting native external indexes", async () => {
    const value = {_id: "public", _local: {public: true}, text: "kept", nested: {items: [1, 2]}};
    await seedLegacy("compact-upgrade", [legacyRow("a", value)]);
    const db = new LocalDatabase({storageKey: "compact-upgrade"});
    expect(await db.read(record("a"))).toEqual(value);
    expect(await getRecordsByType("compact-upgrade", ["meta", "id"])).toEqual([{id: "a", value}]);
    const connection = await rawOpen("compact-upgrade");
    try {
        expect(connection.version).toBe(2);
        const store = connection.transaction("meta").objectStore("meta");
        expect([...store.indexNames]).toEqual(["_identity", "external"]);
        const row = await result(store.index("_identity").get(path("a")));
        expect(row._id).toBe(7);
        expect(row._local).toEqual({path: path("a"), originals: {_id: "public", _local: {public: true}}});
        expect(row._local).not.toHaveProperty("value");
        for (const name of connection.objectStoreNames) {
            const names = [...connection.transaction(name).objectStore(name).indexNames];
            expect(names.some(index => index.startsWith("_field:") || index === "_key0")).toBe(false);
        }
    } finally { connection.close(); }
    expect(await db.create(["meta", "id"], {after: true})).toBe("8");
    const reopened = new LocalDatabase({storageKey: "compact-upgrade"});
    expect(await reopened.read(record("a"))).toEqual(value);
    const unchanged = await rawOpen("compact-upgrade");
    expect(unchanged.version).toBe(2);
    unchanged.close();
});

it("rolls back compaction, index cleanup and version when a new unique index conflicts", async () => {
    await seedLegacy("compact-rollback", [legacyRow("a", {code: "same"}), legacyRow("b", {code: "same"})]);
    const db = new LocalDatabase({storageKey: "compact-rollback", stores: [{
        store: "meta", storeConfig: {keyPath: "_id", autoIncrement: true},
        storeSchema: [{name: "code", keypath: "code", options: {unique: true}}]
    }]});
    await expect(db.read(["meta"])).rejects.toMatchObject({name: "ConstraintError"});
    const connection = await rawOpen("compact-rollback");
    try {
        expect(connection.version).toBe(1);
        const store = connection.transaction("meta").objectStore("meta");
        expect(store.index("_identity").keyPath).toEqual(["_local._collection", "_local._key"]);
        expect(store.indexNames.contains("_field:text")).toBe(true);
        expect(store.indexNames.contains("code")).toBe(false);
        const rows = await result(store.getAll());
        expect(rows).toHaveLength(2);
        expect(rows[0]._local.value).toEqual({code: "same"});
        expect(rows[0]._local).not.toHaveProperty("path");
    } finally { connection.close(); }
});
