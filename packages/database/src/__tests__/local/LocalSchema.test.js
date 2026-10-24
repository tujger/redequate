import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {openDatabase} from "../../local/helpers";
import {LOCAL_SCHEMA} from "../../local/constants";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const schema = {audit: {keyPath: "id", autoIncrement: false, indexes: {byStatus: {keyPath: "status"}}}};
const rawOpen = (name, version) => new Promise((resolve, reject) => {
    const request = indexedDB.open(`redequate:local:${name}`, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

it("exposes a serializable description of the physical version-one stores", async () => {
    const db = new LocalDatabase({storageKey: "description"});
    expect(JSON.parse(JSON.stringify(LOCAL_SCHEMA))).toEqual(LOCAL_SCHEMA);
    await db.applySchema(LOCAL_SCHEMA);
    const connection = await openDatabase("description");
    expect(connection.version).toBe(1);
    expect([...connection.objectStoreNames].sort()).toEqual(Object.keys(LOCAL_SCHEMA).sort());
    connection.close();
});

it("adds a store, updates its indexes, preserves rows, and repeats without a version bump", async () => {
    const db = new LocalDatabase({storageKey: "migration"});
    await db.update(["meta", {id: "before", _: true}], () => ({value: 1}));
    await db.applySchema(schema);
    let connection = await openDatabase("migration");
    expect(connection.version).toBe(2);
    await new Promise((resolve, reject) => {
        const transaction = connection.transaction("audit", "readwrite");
        transaction.objectStore("audit").put({id: "a", status: "open", owner: "u1"});
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
    });
    connection.close();
    await db.applySchema({
        audit: {
            keyPath: "id",
            autoIncrement: false,
            indexes: {
                byStatus: {keyPath: "owner", unique: true}, byOwner: {keyPath: "owner"}
            }
        }
    });
    connection = await openDatabase("migration");
    expect(connection.version).toBe(3);
    const store = connection.transaction("audit").objectStore("audit");
    expect(store.index("byStatus").keyPath).toBe("owner");
    expect(store.index("byStatus").unique).toBe(true);
    expect(store.indexNames.contains("byOwner")).toBe(true);
    expect(await new Promise(resolve => { store.get("a").onsuccess = event => resolve(event.target.result); }))
        .toEqual({id: "a", status: "open", owner: "u1"});
    connection.close();
    await db.applySchema(schema);
    connection = await openDatabase("migration");
    expect(connection.version).toBe(4); // Restoring the original byStatus definition is an update.
    connection.close();
    await db.applySchema(schema);
    connection = await openDatabase("migration");
    expect(connection.version).toBe(4);
    connection.close();
    expect(await db.read(["meta", {id: "before", _: true}])).toEqual({value: 1});
});

it("rejects incompatible store changes without altering data or version", async () => {
    const db = new LocalDatabase({storageKey: "incompatible"});
    await db.update(["meta", {id: "safe", _: true}], () => ({value: 7}));
    await expect(db.applySchema({meta: {keyPath: "other", autoIncrement: false, indexes: {}}}))
        .rejects.toMatchObject({name: "VersionError"});
    const connection = await openDatabase("incompatible");
    expect(connection.version).toBe(1);
    connection.close();
    expect(await db.read(["meta", {id: "safe", _: true}])).toEqual({value: 7});
    await expect(db.applySchema({
        meta: {
            ...LOCAL_SCHEMA.meta,
            indexes: {
                _identity: {keyPath: "value", unique: false}
            }
        }
    })).rejects.toMatchObject({name: "VersionError"});
});

it("rolls back a unique index that conflicts with existing rows", async () => {
    const db = new LocalDatabase({storageKey: "unique-rollback"});
    await db.applySchema(schema);
    const connection = await openDatabase("unique-rollback");
    await new Promise((resolve, reject) => {
        const transaction = connection.transaction("audit", "readwrite");
        transaction.objectStore("audit").put({id: "a", status: "same"});
        transaction.objectStore("audit").put({id: "b", status: "same"});
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
    });
    connection.close();
    await expect(db.applySchema({
        audit: {
            ...schema.audit,
            indexes: {
                byStatus: {keyPath: "status", unique: true}
            }
        }
    })).rejects.toThrow();
    const after = await openDatabase("unique-rollback");
    expect(after.version).toBe(2);
    const store = after.transaction("audit").objectStore("audit");
    expect(store.index("byStatus").unique).toBe(false);
    expect(await new Promise(resolve => { store.count().onsuccess = event => resolve(event.target.result); })).toBe(2);
    after.close();
});

it("closes Local connections on versionchange and reports an external blocker", async () => {
    const db = new LocalDatabase({storageKey: "connections"});
    const local = await openDatabase("connections");
    await db.applySchema(schema);
    expect(() => local.transaction("meta")).toThrow();
    const external = await rawOpen("connections");
    await expect(db.applySchema({
        audit: {
            ...schema.audit,
            indexes: {
                ...schema.audit.indexes, byOwner: {keyPath: "owner"}
            }
        }
    })).rejects.toThrow(/blocked/);
    external.close();
    await db.applySchema({
        audit: {
            ...schema.audit,
            indexes: {
                ...schema.audit.indexes, byOwner: {keyPath: "owner"}
            }
        }
    });
    const connection = await openDatabase("connections");
    expect(connection.transaction("audit").objectStore("audit").indexNames.contains("byOwner")).toBe(true);
    connection.close();
});

it("converges when two callers add different stores at the same time", async () => {
    const first = new LocalDatabase({storageKey: "race"});
    const second = new LocalDatabase({storageKey: "race"});
    await Promise.all([
        first.applySchema(schema),
        second.applySchema({auditOther: {keyPath: "id", autoIncrement: false, indexes: {}}})
    ]);
    const connection = await openDatabase("race");
    expect(connection.objectStoreNames.contains("audit")).toBe(true);
    expect(connection.objectStoreNames.contains("auditOther")).toBe(true);
    connection.close();
});
