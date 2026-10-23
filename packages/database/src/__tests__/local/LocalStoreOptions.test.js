import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import stores from "../../local/stores.json";
import {convertStores, LOCAL_SCHEMA} from "../../local/constants";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const definition = (store = "audit", storeSchema = []) => ({
    store, storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema
});
const audit = definition("audit", [
    {name: "byStatus", keypath: "status"},
    {name: "byOwnerStatus", keypath: ["owner", "status"]},
    {name: "byCode", keypath: "code", options: {unique: true}}
]);
const record = id => ["audit", {audit_id: id}];
const raw = (storageKey, run) => new Promise((resolve, reject) => {
    const request = indexedDB.open(`redequate:local:${storageKey}`);
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
        try { resolve(await run(request.result)); } catch (error) { reject(error); }
        finally { request.result.close(); }
    };
});
const result = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

it("converts every JSON store and index, preserving the source and isolating metadata", () => {
    const before = structuredClone(stores);
    const schema = convertStores();
    expect(Object.keys(schema)).toEqual(stores.map(entry => entry.store));
    for (const entry of stores) {
        expect(schema[entry.store]).toMatchObject(entry.storeConfig);
        for (const index of entry.storeSchema) {
            expect(schema[entry.store].indexes[index.name]).toEqual({
                keyPath: index.keypath, unique: index.options?.unique ?? false
            });
        }
        expect(schema[entry.store].indexes._identity).toEqual({
            keyPath: "_local.path", unique: true
        });
    }
    schema.posts.indexes.post_id.keyPath = "changed";
    expect(stores).toEqual(before);
    expect(LOCAL_SCHEMA.posts.indexes.post_id.keyPath).toBe("post_id");
});

it("merges additions without mutating them and rejects conflicting or invalid definitions before opening", () => {
    const additions = [definition("posts", [{name: "byTitle", keypath: "title"}]), audit];
    const before = structuredClone(additions);
    const converted = convertStores(additions);
    expect(converted.posts.indexes).toHaveProperty("post_id");
    expect(converted.posts.indexes.byTitle.keyPath).toBe("title");
    expect(converted.audit.indexes.byOwnerStatus.keyPath).toEqual(["owner", "status"]);
    expect(additions).toEqual(before);
    const open = vi.spyOn(indexedDB, "open");
    for (const stores of [null, {}, [definition("posts", [{name: "post_id", keypath: "other"}])],
        [definition("posts", [{name: "_identity", keypath: "other"}])],
        [{...audit, storeConfig: {keyPath: "different", autoIncrement: true}}],
        [definition("audit", [{name: "bad", keypath: "_local.value"}])],
        [definition("audit", [{name: "bad", keypath: "a..b"}])],
        [definition("audit", [{name: "bad", keypath: ["a", "b"], options: {multiEntry: true}}])]]) {
        expect(() => new LocalDatabase({stores})).toThrow(TypeError);
    }
    expect(open).not.toHaveBeenCalled();
});

it("creates the complete schema at version one and supports CRUD, nested paths and cursors", async () => {
    const db = new LocalDatabase({storageKey: "custom", stores: [audit]});
    const key = await db.create(["audit", "audit_id"], key => ({code: key, status: "open", owner: "alice"}));
    expect(key).toBe("1");
    await db.update(record(key), {status: "closed"});
    await db.update([...record(key), "notes", {note_id: "n1"}], () => ({text: "note"}));
    expect(await db.read(record(key))).toEqual({code: "1", status: "closed", owner: "alice", notes: {n1: {text: "note"}}});
    expect(await db.cursor(["audit", "audit_id"], {orderBy: "status"}).next(10)).toEqual([
        {key, value: {code: "1", status: "closed", owner: "alice", notes: {n1: {text: "note"}}}}
    ]);
    await raw("custom", async connection => {
        expect(connection.version).toBe(1);
        const store = connection.transaction("audit").objectStore("audit");
        expect(store.keyPath).toBe("_id");
        const row = await result(store.index("byOwnerStatus").get(["alice", "closed"]));
        expect(row).toMatchObject({_id: 1, status: "closed", _local: {path: JSON.stringify([["fixed", "audit_id", "1"]])}});
    });
    await db.delete(record(key));
    expect(await db.read(record(key))).toBeUndefined();
});

it("preserves caller fields that collide with metadata and refreshes native indexes on replacement", async () => {
    const db = new LocalDatabase({storageKey: "payload", stores: [audit]});
    const value = {_id: "public", _local: {public: true}, _key: "public", value: "public", status: "old", code: "x"};
    await db.update(record("a"), () => value);
    expect(await db.read(record("a"))).toEqual(value);
    await db.update(record("a"), () => ({status: "new", code: "y"}));
    await raw("payload", async connection => {
        const store = connection.transaction("audit").objectStore("audit");
        const [old, current] = await Promise.all([result(store.index("byCode").get("x")), result(store.index("byCode").get("y"))]);
        expect(old).toBeUndefined();
        expect(current).toMatchObject({status: "new", code: "y", _id: 1});
    });
});

it("enforces unique JSON indexes and rolls back cross-store writes and generated IDs", async () => {
    const db = new LocalDatabase({storageKey: "unique", stores: [audit]});
    await db.create(record("a"), {code: "same"});
    await expect(db.create(["audit", "audit_id"], {code: "same"})).rejects.toMatchObject({name: "ConstraintError"});
    await expect(db.update(new Map([
        [["meta", {id: "safe"}], {changed: true}], [record("b"), {code: "same"}]
    ]))).rejects.toMatchObject({name: "ConstraintError"});
    expect(await db.read(["meta", {id: "safe"}])).toBeUndefined();
    expect(await db.create(["audit", "audit_id"], {code: "different"})).toBe("2");
    const users = new LocalDatabase({storageKey: "base-unique"});
    await users.update(["users_public", {user_id: "u"}], () => ({name: "first"}));
    await expect(users.update(["users_public", {user_id: "u", _: true}], () => ({name: "second"})))
        .rejects.toMatchObject({name: "ConstraintError"});
});

it("adds constructor stores and indexes in one version bump, preserves rows, and does not bump twice", async () => {
    const before = new LocalDatabase({storageKey: "versions"});
    await before.update(["meta", {id: "a"}], () => ({status: "open"}));
    const additions = [audit, definition("meta", [{name: "byStatus", keypath: "status"}])];
    const upgraded = new LocalDatabase({storageKey: "versions", stores: additions});
    await Promise.all([upgraded.read(["meta", {id: "a"}]), upgraded.read(["audit"])]);
    await raw("versions", async connection => {
        expect(connection.version).toBe(2);
        expect(await result(connection.transaction("meta").objectStore("meta").index("byStatus").getKey("open"))).toBe(1);
    });
    const reopened = new LocalDatabase({storageKey: "versions", stores: additions});
    expect(await reopened.read(["meta", {id: "a"}])).toEqual({status: "open"});
    await raw("versions", connection => expect(connection.version).toBe(2));
});

it("backfills address fields when adding a compound index to existing child rows", async () => {
    const first = new LocalDatabase({storageKey: "compound-upgrade", stores: [definition()]});
    await first.update(["audit", {owner: "alice"}, {audit_id: "a"}], () => ({status: "open"}));
    const second = new LocalDatabase({storageKey: "compound-upgrade", stores: [definition("audit", [
        {name: "ownerId", keypath: ["owner", "audit_id"], options: {unique: true}}
    ])]});
    await second.read(["audit"]);
    await raw("compound-upgrade", async connection => {
        expect(connection.version).toBe(2);
        expect(await result(connection.transaction("audit").objectStore("audit").index("ownerId").getKey(["alice", "a"]))).toBe(1);
    });
});

it("isolates configured collections while sharing committed notifications between instances", async () => {
    const writer = new LocalDatabase({storageKey: "events", stores: [audit]});
    const reader = new LocalDatabase({storageKey: "events", stores: [audit]});
    const plain = new LocalDatabase({storageKey: "events"});
    const change = vi.fn(), event = vi.fn();
    const listener = reader.addEventListener(["audit"], {onChange: change});
    const subscription = reader.cursor(["audit", "audit_id"]).subscribe(event);
    try {
        await vi.waitFor(() => expect(change).toHaveBeenCalledOnce());
        await writer.create(record("a"), {code: "a", status: "open"});
        await vi.waitFor(() => expect(event).toHaveBeenCalledOnce());
        expect(change).toHaveBeenLastCalledWith({a: {code: "a", status: "open"}});
        await expect(plain.read(["audit"])).rejects.toMatchObject({code: "database/invalid-argument"});
        const onError = vi.fn();
        const invalidListener = plain.addEventListener(["audit"], {onError});
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining("Unknown Local collection")}),
            "addEventListener", {path: ["audit"]});
        expect(() => invalidListener.remove()).not.toThrow();
        expect(await plain.cursor([]).next(10)).toEqual([]);
    } finally { listener.remove(); subscription.unsubscribe(); }
});

it("converges when instances initialize different additions concurrently", async () => {
    const first = new LocalDatabase({storageKey: "parallel", stores: [audit]});
    const second = new LocalDatabase({storageKey: "parallel", stores: [definition("other")]});
    await Promise.all([first.create(record("a"), {code: "a"}), second.create(["other", "id"], {text: "other"})]);
    await raw("parallel", connection => {
        expect(connection.objectStoreNames.contains("audit")).toBe(true);
        expect(connection.objectStoreNames.contains("other")).toBe(true);
    });
    expect(await first.read(record("a"))).toEqual({code: "a"});
    await expect(first.read(["other"])).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("rolls back a constructor upgrade on duplicate values and reports the initialization failure", async () => {
    const original = new LocalDatabase({storageKey: "failed-upgrade", stores: [definition()]});
    await original.create(record("a"), {status: "same"});
    await original.create(record("b"), {status: "same"});
    const onError = vi.fn();
    const upgraded = new LocalDatabase({storageKey: "failed-upgrade", onError, stores: [definition("audit", [
        {name: "statusUnique", keypath: "status", options: {unique: true}}
    ])]});
    expect(await upgraded.read(["audit"])).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({name: "ConstraintError"}), "read", expect.any(Object));
    await raw("failed-upgrade", async connection => {
        expect(connection.version).toBe(1);
        const store = connection.transaction("audit").objectStore("audit");
        expect(store.indexNames.contains("statusUnique")).toBe(false);
        expect(await result(store.count())).toBe(2);
    });
    await original.delete(record("b"));
    expect(await upgraded.read(record("a"))).toEqual({status: "same"});
    await raw("failed-upgrade", connection => expect(connection.version).toBe(2));
});

it("upgrades missing JSON indexes in a compatible base schema", async () => {
    const db = new LocalDatabase({storageKey: "base-upgrade"});
    await db.create(["posts", {post_id: "p1"}], {text: "kept"});
    await new Promise((resolve, reject) => {
        const request = indexedDB.open("redequate:local:base-upgrade", 2);
        request.onupgradeneeded = () => request.transaction.objectStore("posts").deleteIndex("post_id");
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error);
    });
    const reopened = new LocalDatabase({storageKey: "base-upgrade"});
    expect(await reopened.read(["posts", {post_id: "p1"}])).toEqual({text: "kept"});
    await raw("base-upgrade", async connection => {
        expect(connection.version).toBe(3);
        expect(await result(connection.transaction("posts").objectStore("posts").index("post_id").getKey("p1"))).toBe(1);
    });
});

it("reports blocked constructor upgrades to listeners and permits a later retry", async () => {
    const initial = new LocalDatabase({storageKey: "blocked-options"});
    await initial.read(["meta"]);
    const blocker = await raw("blocked-options", connection => {
        // Open an independent connection that deliberately ignores versionchange.
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(connection.name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
    const upgraded = new LocalDatabase({storageKey: "blocked-options", stores: [audit]});
    const onError = vi.fn();
    const handle = upgraded.addEventListener(["audit"], {onError});
    try {
        await vi.waitFor(() => expect(onError).toHaveBeenCalled());
        expect(onError.mock.calls[0][0].message).toContain("blocked");
    } finally { handle.remove(); blocker.close(); }
    await upgraded.create(record("a"), {code: "a"});
    expect(await upgraded.read(record("a"))).toEqual({code: "a"});
});

it("supports multiEntry indexes and protects required custom indexes through applySchema", async () => {
    const db = new LocalDatabase({storageKey: "multi", stores: [definition("audit", [
        {name: "tags", keypath: "tags", options: {multiEntry: true}}
    ])]});
    await db.create(record("a"), {tags: ["one", "two"]});
    await raw("multi", async connection => {
        const index = connection.transaction("audit").objectStore("audit").index("tags");
        expect(index.multiEntry).toBe(true);
        expect(await result(index.getKey("two"))).toBe(1);
    });
    await expect(db.applySchema({audit: {keyPath: "_id", autoIncrement: true,
        indexes: {tags: {keyPath: "other"}}}})).rejects.toMatchObject({name: "VersionError"});
});

it("indexes scalar field writes using their actual value rather than the field marker", async () => {
    const db = new LocalDatabase({storageKey: "scalar-index"});
    const path = ["users_public", {user_id: "u"}, {email: "email"}];
    await db.update(path, () => "user@example.test");
    expect(await db.read(path)).toBe("user@example.test");
    await raw("scalar-index", async connection => {
        const store = connection.transaction("users_public").objectStore("users_public");
        const row = await result(store.index("email").get("user@example.test"));
        expect(row).toMatchObject({email: "user@example.test"});
        expect(row._local).not.toHaveProperty("value");
    });
});
