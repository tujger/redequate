import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import {openLocalDatabase} from "../../../../common/src/localDatabase";
import LocalDatabase from "../../local";
import {openDatabase} from "../../../../backend/src/local/database/helpers";
import {LOCAL_SCHEMA} from "../../../../backend/src/local/database/constants";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const schema = {audit: {keyPath: "id", autoIncrement: false, indexes: {byStatus: {keyPath: "status"}}}};
const rawOpen = (name, version) => new Promise((resolve, reject) => {
    const request = indexedDB.open(`${name}`, version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

it("exposes a serializable application schema and preserves an unknown provider store", async () => {
    const providerSchema = {$customProvider: {
        keyPath: "id", autoIncrement: false,
        indexes: {byCategory: {keyPath: "category", unique: true}}
    }};
    const provider = await openLocalDatabase("description", providerSchema);
    try {
        await new Promise((resolve, reject) => {
            const transaction = provider.transaction("$customProvider", "readwrite");
            transaction.objectStore("$customProvider").put({id: "token", category: "saved"});
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { provider.close(); }
    const db = new LocalDatabase({storageId: "description"});
    expect(JSON.parse(JSON.stringify(LOCAL_SCHEMA))).toEqual(LOCAL_SCHEMA);
    await db.applySchema(LOCAL_SCHEMA);
    await expect(db.applySchema(providerSchema)).rejects.toThrow(TypeError);
    expect(() => new LocalDatabase({stores: [{
        store: "$customProvider", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: []
    }]})).toThrow(TypeError);
    const connection = await openDatabase("description");
    try {
        expect(connection.version).toBe(2);
        expect([...connection.objectStoreNames].sort()).toEqual(["$customProvider", ...Object.keys(LOCAL_SCHEMA)].sort());
        const store = connection.transaction("$customProvider").objectStore("$customProvider");
        expect(store.keyPath).toBe("id");
        expect([...store.indexNames]).toEqual(["byCategory"]);
        expect(store.index("byCategory").keyPath).toBe("category");
        expect(store.index("byCategory").unique).toBe(true);
        expect(await new Promise((resolve, reject) => {
            const request = store.get("token");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })).toEqual({id: "token", category: "saved"});
    } finally { connection.close(); }
});

it("adds a store, updates its indexes, preserves rows, and repeats without a version bump", async () => {
    const db = new LocalDatabase({storageId: "migration"});
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
    const db = new LocalDatabase({storageId: "incompatible"});
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
    const db = new LocalDatabase({storageId: "unique-rollback"});
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
    const db = new LocalDatabase({storageId: "connections"});
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
    const first = new LocalDatabase({storageId: "race"});
    const second = new LocalDatabase({storageId: "race"});
    await Promise.all([
        first.applySchema(schema),
        second.applySchema({auditOther: {keyPath: "id", autoIncrement: false, indexes: {}}})
    ]);
    const connection = await openDatabase("race");
    expect(connection.objectStoreNames.contains("audit")).toBe(true);
    expect(connection.objectStoreNames.contains("auditOther")).toBe(true);
    connection.close();
});
