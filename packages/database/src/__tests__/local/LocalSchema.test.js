import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local";
import {openDatabase} from "../../local/helpers";
import {convertStores, LOCAL_SCHEMA} from "../../local/storeSchema";
import stores from "../../local/stores.json";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const audit = {store: "audit", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [
    {name: "audit_id", keypath: "audit_id", options: {unique: true}},
    {name: "code", keypath: "code", options: {unique: true}}
]};
const make = storageId => new LocalDatabase({storageId, stores: [audit], backend: new LocalBackend({storageId})});

it("converts exactly the indexes declared by the caller and built-in schema", () => {
    const schema = convertStores([audit]);
    for (const definition of [...stores, audit]) {
        expect(Object.keys(schema[definition.store].indexes)).toEqual(definition.storeSchema.map(index => index.name));
    }
    expect(schema.meta.indexes).toEqual({});
    expect(LOCAL_SCHEMA.posts.indexes.post_id).toMatchObject({keyPath: "post_id", unique: true});
});

it("creates the declared schema at version one and leaves it stable when reopened", async () => {
    const database = make("schema-native");
    expect(await database.read(["audit"])).toBeUndefined();
    let connection = await openDatabase("schema-native");
    expect(connection.version).toBe(1);
    expect([...connection.transaction("audit").objectStore("audit").indexNames]).toEqual(["audit_id", "code"]);
    connection.close();
    await database.create(["audit", {audit_id: "a"}], {code: "one"});
    const reopened = make("schema-native");
    expect(await reopened.read(["audit", {audit_id: "a"}])).toEqual({_id: 1, audit_id: "a", code: "one"});
    connection = await openDatabase("schema-native");
    expect(connection.version).toBe(1);
    connection.close();
});

it("lets native unique indexes abort a cross-store transaction", async () => {
    const database = make("schema-unique");
    await database.read(["audit"]);
    await database.create(["audit", {audit_id: "a"}], {code: "one"});
    await expect(database.update(new Map([
        [["posts", {post_id: "p1"}], {title: "must roll back"}],
        [["audit", {audit_id: "b"}], {code: "one"}]
    ]))).rejects.toMatchObject({name: "ConstraintError"});
    expect(await database.read(["posts", {post_id: "p1"}])).toBeUndefined();
    expect(await database.read(["audit", {audit_id: "b"}])).toBeUndefined();
});

it("adds declared indexes without rewriting records or changing native primary keys", async () => {
    const database = make("schema-add-index");
    await database.read(["audit"]);
    await database.create(["audit", {audit_id: "a"}], {code: "one", category: "books"});
    const before = await database.read(["audit", {audit_id: "a"}]);
    await database.applySchema({audit: {...convertStores([audit]).audit, indexes: {
        ...convertStores([audit]).audit.indexes, category: {keyPath: "category", unique: false}
    }}});
    const after = await database.read(["audit", {audit_id: "a"}]);
    expect(after).toEqual(before);
    expect(await database.read(["audit", {category: "books"}], {orderBy: "category", equalTo: "books"}))
        .toEqual({a: before});
    let connection = await openDatabase("schema-add-index");
    const version = connection.version;
    expect(version).toBe(2);
    connection.close();
    await database.applySchema({audit: {...convertStores([audit]).audit, indexes: {
        ...convertStores([audit]).audit.indexes, category: {keyPath: "category", unique: false}
    }}});
    connection = await openDatabase("schema-add-index");
    expect(connection.version).toBe(version);
    connection.close();
});

it("protects required index definitions and native store configuration", async () => {
    const database = make("schema-constraints");
    await database.read(["audit"]);
    await expect(database.applySchema({audit: {...convertStores([audit]).audit, keyPath: "other"}}))
        .rejects.toMatchObject({name: "VersionError"});
    await expect(database.applySchema({audit: {...convertStores([audit]).audit, indexes: {
        audit_id: {keyPath: "audit_id", unique: false}
    }}})).rejects.toMatchObject({name: "VersionError"});
    const connection = await openDatabase("schema-constraints");
    expect(connection.version).toBe(1);
    connection.close();
});

it("keeps configured collections instance-scoped and provider stores separate", async () => {
    const database = make("schema-scope");
    await database.read(["audit"]);
    await database.create(["audit", {audit_id: "a"}], {code: "one"});
    const plain = new LocalDatabase({storageId: "schema-scope", backend: new LocalBackend({storageId: "schema-scope"})});
    await expect(plain.read(["audit"])).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.applySchema({$auth: {keyPath: "id", autoIncrement: false, indexes: {}}})).rejects.toBeInstanceOf(TypeError);
    await expect(new LocalBackend({storageId: "schema-scope"}).request("database.create", ["$auth", {id: "a"}], {}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});
