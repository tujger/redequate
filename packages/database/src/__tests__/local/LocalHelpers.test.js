import {vi} from "vitest";
import {IDBFactory, IDBDatabase, IDBTransaction} from "fake-indexeddb";
import {getRecord, getRecordsByType, interpretPath, openDatabase} from "../../../../backend/src/local/database/helpers";
import {addRecord, deleteRecord, putRecord} from "../../../../backend/src/local/database/writes";
import {indexesForStore, LOCAL_COLLECTIONS} from "../../../../backend/src/local/database/constants";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const friendship = ["mutual", {friendship: "m123", _: true}];
const subscription = ["mutual", {subscription: "m123", _: true}];
const created = value => value;

it("stores different dynamic types with JSON indexes and one unique path index", async () => {
    const first = {type: "user kind", user_id: "u_1", nested_data: {friend_id: "u_2"}};
    await addRecord("test", friendship, first);
    await addRecord("test", subscription, {type: "premium"});
    await addRecord("test", ["errors", {friendship: "m123", _: true}], {type: "other collection"});
    expect(await getRecord("test", friendship)).toEqual(created(first));
    expect(await getRecord("test", subscription)).toEqual(created({type: "premium"}));
    expect(await getRecordsByType("test", ["mutual", "friendship"])).toEqual([{id: "m123", value: created(first)}]);
    expect(await getRecordsByType("test", ["mutual", "subscription"])).toEqual([
        {id: "m123", value: created({type: "premium"})}
    ]);
    const database = await openDatabase("test");
    try {
        expect([...database.objectStoreNames]).toEqual(Object.keys(LOCAL_COLLECTIONS).sort());
        const store = database.transaction("mutual").objectStore("mutual");
        expect(store.keyPath).toBe("_id");
        expect(store.autoIncrement).toBe(true);
        expect(store.index("_identity").unique).toBe(true);
        expect([...store.indexNames]).toEqual(Object.keys(indexesForStore("mutual")).sort());
        expect(store.index("_identity").keyPath).toBe("_local.path");
        expect(store.indexNames.contains("_key0")).toBe(false);
        const request = store.index("_identity").get(JSON.stringify([["dynamic", 0, "friendship", "m123"]]));
        await new Promise((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        expect(request.result._local).toEqual({path: JSON.stringify([["dynamic", 0, "friendship", "m123"]])});
        expect(request.result.nested_data).toEqual(first.nested_data);
        expect(request.result).not.toHaveProperty("_conditions");
    } finally { database.close(); }
});

it("uses the same record identity, fields and type index for true and zero", async () => {
    const numeric = ["mutual", {friendship: "m123", _: 0}];
    expect(interpretPath(friendship)).toEqual(interpretPath(numeric));
    await addRecord("test", friendship, {status: "created"});
    await expect(addRecord("test", numeric, {status: "duplicate"}))
        .rejects.toMatchObject({name: "ConstraintError"});
    expect(await getRecord("test", numeric)).toEqual(created({status: "created"}));
    await putRecord("test", numeric, {status: "updated"});
    expect(await getRecord("test", friendship)).toEqual(created({status: "updated"}));
    expect(await getRecordsByType("test", ["mutual", {_key0: "friendship"}]))
        .toEqual([{id: "m123", value: created({status: "updated"})}]);
    await deleteRecord("test", friendship);
    expect(await getRecord("test", numeric)).toBeUndefined();
});

it("treats a named type segment as metadata even when its name is type", async () => {
    const path = ["mutual", {type: "friendship", _: true}];
    const value = {type: "ordinary user field", _type: "user value", id: "user ID"};
    await putRecord("test", path, value);
    expect(await getRecord("test", path)).toEqual(created(value));
    expect(await getRecord("test", ["mutual", {friendship: "friendship", _: true}])).toBeUndefined();
    expect(await getRecordsByType("test", ["mutual", "type"])).toEqual([
        {id: "friendship", value: created(value)}
    ]);
});

it("identifies records by fixed conditions and dynamic levels regardless of segment position", async () => {
    const first = ["mutual", {user_id: "u123"}, {friendship: "m123", _: 0},
        "members", {active: "a456", _: 1}];
    const second = ["mutual", {friendship: "m123", _: 0}, {user_id: "u123"},
        "members", {active: "a456", _: 1}];
    const value = {nested: {status: "ready"}, id: "user data"};
    await addRecord("test", first, value);
    await expect(addRecord("test", second, {nested: {status: "second"}})).rejects.toMatchObject({name: "ConstraintError"});
    expect(await getRecord("test", second)).toEqual(created(value));
    await putRecord("test", second, {nested: {status: "second"}});
    await addRecord("test", ["mutual", {user_id: "u999"}, {friendship: "m123", _: 0},
        "members", {active: "a456", _: 1}], {nested: {status: "other user"}});
    expect(await getRecord("test", first)).toEqual(created({nested: {status: "second"}}));
    expect(await getRecord("test", second)).toEqual(created({nested: {status: "second"}}));
    expect(await getRecordsByType("test", ["mutual", {_key0: "friendship", _key1: "active", user_id: "u123"}]))
        .toEqual([{id: "a456", value: created({nested: {status: "second"}})}]);
    expect(await getRecordsByType("test", ["mutual", {_key1: "active", user_id: "u999"}]))
        .toEqual([{id: "a456", value: created({nested: {status: "other user"}})}]);
    const database = await openDatabase("test");
    try {
        const store = database.transaction("mutual").objectStore("mutual");
        const count = store.count();
        const record = store.index("_identity").get(JSON.stringify([["fixed", "user_id", "u123"],
            ["dynamic", 0, "friendship", "m123"], ["literal", "members"],
            ["dynamic", 1, "active", "a456"]]));
        await Promise.all([count, record].map(request => new Promise(resolve => { request.onsuccess = resolve; })));
        expect(count.result).toBe(2);
        expect(record.result._local).toEqual({path: JSON.stringify([["fixed", "user_id", "u123"],
            ["dynamic", 0, "friendship", "m123"], ["literal", "members"],
            ["dynamic", 1, "active", "a456"]])});
    } finally { database.close(); }
});

it("keeps fixed named segments out of dynamic type indexes", async () => {
    const path = ["users_public", {user_id: "u123"}];
    await putRecord("test", path, {profile: {name: "Alex"}});
    expect(await getRecord("test", path)).toEqual(created({profile: {name: "Alex"}}));
    expect(await getRecordsByType("test", ["users_public", "user_id"])).toEqual([]);
});

it("keeps fixed and dynamic identities distinct when their named values match", async () => {
    const fixed = ["mutual", {friendship: "m123"}];
    await putRecord("test", fixed, {status: "fixed"});
    await putRecord("test", friendship, {status: "dynamic"});
    expect(await getRecord("test", fixed)).toEqual(created({status: "fixed"}));
    expect(await getRecord("test", friendship)).toEqual(created({status: "dynamic"}));
    expect(await getRecordsByType("test", ["mutual", "friendship"]))
        .toEqual([{id: "m123", value: created({status: "dynamic"})}]);
});

it("uses the numeric dynamic level rather than its array position", async () => {
    const path = ["mutual", {active: "a456", _: 1}, {user_id: "u123"},
        {friendship: "m123", _: 0}];
    await putRecord("test", path, {nested: {kept: true}});
    expect(await getRecord("test", path)).toEqual(created({nested: {kept: true}}));
    expect(await getRecordsByType("test", ["mutual", {_key0: "friendship", _key1: "active"}]))
        .toEqual([{id: "a456", value: created({nested: {kept: true}})}]);
});

it("adds, replaces and deletes whole records without splitting nested values", async () => {
    await expect(getRecord("test", friendship)).resolves.toBeUndefined();
    await addRecord("test", friendship, {nested: {items: [1, 2]}});
    await expect(addRecord("test", friendship, {nested: {items: []}})).rejects.toMatchObject({name: "ConstraintError"});
    expect(await getRecord("test", friendship)).toEqual(created({nested: {items: [1, 2]}}));
    await putRecord("test", friendship, {type: "replacement"});
    expect(await getRecord("test", friendship)).toEqual(created({type: "replacement"}));
    await deleteRecord("test", friendship);
    await deleteRecord("test", friendship);
    expect(await getRecordsByType("test", ["mutual", "friendship"])).toEqual([]);
});

it("reads and changes one top-level field within the same record", async () => {
    await putRecord("test", friendship, {type: "original", snake_case: {nested: true}});
    expect(await getRecord("test", [...friendship, "snake_case"])).toEqual({nested: true});
    await putRecord("test", [...friendship, "type"], "changed");
    await addRecord("test", [...friendship, "added_field"], false);
    await expect(addRecord("test", [...friendship, "type"], "duplicate")).rejects.toMatchObject({name: "ConstraintError"});
    await deleteRecord("test", [...friendship, "snake_case"]);
    expect(await getRecord("test", friendship)).toEqual(created({type: "changed", added_field: false}));
    const missing = ["mutual", {friendship: "missing", _: true}];
    await putRecord("test", [...missing, "field"], 1);
    expect(await getRecord("test", missing)).toEqual(created({field: 1}));
    await deleteRecord("test", [...missing, "field"]);
    expect(await getRecord("test", [...missing, "field"])).toBeUndefined();
});

it("isolates storage keys in separate IndexedDB databases", async () => {
    await putRecord("one", friendship, {type: "one"});
    await putRecord("two", friendship, {type: "two"});
    const one = await openDatabase("one");
    const two = await openDatabase("two");
    try {
        expect(one.name).toBe("one");
        expect(two.name).toBe("two");
    } finally { one.close(); two.close(); }
    await deleteRecord("one", friendship);
    expect(await getRecordsByType("one", ["mutual", "friendship"])).toEqual([]);
    expect(await getRecord("two", friendship)).toEqual(created({type: "two"}));
});

it("resolves writes on commit and reports transaction aborts", async () => {
    const dispatch = vi.spyOn(IDBTransaction.prototype, "dispatchEvent");
    await putRecord("test", friendship, {type: "initial"});
    expect(dispatch.mock.calls.some(([event]) => event.type === "complete")).toBe(true);
    const original = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (...args) {
        const transaction = original.apply(this, args);
        queueMicrotask(() => transaction.abort());
        return transaction;
    });
    await expect(putRecord("test", friendship, {type: "later"})).rejects.toThrow("transaction aborted");
});

it("rejects unsupported paths before opening IndexedDB", async () => {
    const open = vi.spyOn(indexedDB, "open");
    const invalid = [null, "mutual/m123", [],
        ["mutual", {}], ["mutual", {friendship: 123, _: true}], ["mutual", {friendship: "", _: true}],
        ["mutual", {friendship: "m123", subscription: "m456", _: true}],
        ["mutual", {friendship: "m123", _: false}], ["mutual", {friendship: "m123", _: -1}],
        ["mutual", {friendship: "m123", _: "0"}], ["mutual", {friendship: "m123", _: null}],
        ["mutual", {friendship: "m123", _type: 0}], ["mutual", {friendship: "m123", _: 1.5}],
        ["mutual", {friendship: "m123", _: Number.MAX_SAFE_INTEGER + 1}],
        ["mutual", {friendship: "m123", _: 0}, {active: "a456", _: 0}]];
    for (const path of invalid) {
        for (const action of [getRecord, addRecord, putRecord, deleteRecord]) {
            await expect(action("test", path, {type: "value"})).rejects.toMatchObject({code: "database/invalid-argument"});
        }
    }
    for (const path of [["mutual"], ["mutual", "friendship"],
        ["mutual", {friendship: "m123", _: true}, "field", "nested"]]) {
        for (const action of [addRecord, putRecord, deleteRecord]) {
            await expect(action("test", path, {type: "value"})).rejects.toMatchObject({code: "database/invalid-argument"});
        }
    }
    for (const path of [friendship, ["mutual"], ["mutual", ""], ["mutual", "friendship", "extra"],
        ["mutual", {_key0: "friendship", _key1: 1}]]) {
        await expect(getRecordsByType("test", path)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(open).not.toHaveBeenCalled();
});

it("rejects when IndexedDB cannot be opened", async () => {
    const error = new Error("IndexedDB unavailable");
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw error; });
    await expect(getRecord("test", friendship)).rejects.toBe(error);
});
