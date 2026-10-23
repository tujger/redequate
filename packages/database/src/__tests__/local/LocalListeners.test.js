import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const collection = ["meta"];
const record = key => ["meta", {record_id: key, _: true}];
const created = value => value;

it.each([
    {orderBy: ["details", "score"], last: "a"},
    {orderBy: ["details", {field: "score", _: 0}], last: "a"},
    {orderBy: "details/score", last: "b"}
])("orders child additions by ready field segments: %j", async ({orderBy, last}) => {
    const database = new LocalDatabase({storageKey: "field-order"});
    await database.update(record("a"), () => ({details: {score: 2}, "details/score": 1}));
    await database.update(record("b"), () => ({details: {score: 1}, "details/score": 2}));
    const onChildAdd = vi.fn();
    const listener = database.addEventListener(collection, {orderBy, onChildAdd});
    try {
        await vi.waitFor(() => expect(onChildAdd).not.toHaveBeenCalled());
        await database.update(record("c"), () => ({details: {score: 3}, "details/score": 3}));
        expect(onChildAdd.mock.calls.at(-1)[0].key).toBe("c");
    } finally { listener.remove(); }
});

it("delivers initial value and only keys above the initial maximum, then CRUD events", async () => {
    const database = new LocalDatabase({storageKey: "events"});
    await database.update(record("a"), () => ({score: 1}));
    await database.update(record("b"), () => ({score: 2}));
    const onChange = vi.fn(), onChildAdd = vi.fn(), onChildChange = vi.fn(), onChildRemove = vi.fn();
    const listener = database.addEventListener(collection, {onChange, onChildAdd, onChildChange, onChildRemove, orderBy: "score"});
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith({a: created({score: 1}), b: created({score: 2})});
    expect(onChildAdd).not.toHaveBeenCalled();
    await database.update(record("c"), () => ({score: 3}));
    expect(onChildAdd).toHaveBeenLastCalledWith({key: "c", value: created({score: 3})});
    await database.update(record("a"), {score: 4});
    expect(onChildChange).toHaveBeenLastCalledWith({key: "a", value: created({score: 4})});
    expect(onChildAdd).toHaveBeenLastCalledWith({key: "c", value: created({score: 3})});
    await database.delete(record("a"));
    expect(onChildRemove).toHaveBeenLastCalledWith({key: "a", value: created({score: 4})});
    expect(onChildAdd).toHaveBeenLastCalledWith({key: "c", value: created({score: 3})});
    listener.remove();
});

it("reports an invalid feed path and returns a safe cleanup handle", () => {
    const onError = vi.fn();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
        const database = new LocalDatabase({storageKey: "invalid-feed", onError});
        const path = "discover/user-1";
        const handle = database.addEventListener(path, {onChildAdd: vi.fn()});
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}),
            "addEventListener", {path});
        expect(logged).toHaveBeenCalledWith("LocalDatabase listener error", expect.objectContaining({
            path, reason: "addEventListener", error: expect.objectContaining({code: "database/invalid-argument"})
        }));
        expect(() => handle.remove()).not.toThrow();
        const defaultHandle = new LocalDatabase({storageKey: "invalid-feed-default"})
            .addEventListener(path, {onChildAdd: vi.fn()});
        expect(() => defaultHandle.remove()).not.toThrow();
    } finally { logged.mockRestore(); }
});

it("watches records and fields, including creation, replacement and deletion", async () => {
    const database = new LocalDatabase({storageKey: "fields-listeners"});
    const recordValue = vi.fn(), fieldValue = vi.fn(), childChange = vi.fn(), childRemove = vi.fn();
    const a = database.addEventListener(record("a"), {onChange: recordValue, onChildChange: childChange, onChildRemove: childRemove});
    const b = database.addEventListener([...record("a"), "name"], {onChange: fieldValue});
    await vi.waitFor(() => expect(fieldValue).toHaveBeenCalledWith(undefined));
    await database.update(record("a"), () => ({name: "first", kept: true}));
    await database.update([...record("a"), "name"], () => "second");
    expect(fieldValue).toHaveBeenLastCalledWith("second");
    expect(childChange).toHaveBeenCalledWith({key: "name", value: "second"});
    await database.delete([...record("a"), "kept"]);
    expect(childRemove).toHaveBeenCalledWith({key: "kept", value: true});
    await database.delete(record("a"));
    expect(recordValue).toHaveBeenLastCalledWith(undefined);
    expect(fieldValue).toHaveBeenLastCalledWith(undefined);
    a.remove();b.remove();
});

it("keeps subscribers independent and stops initial or later delivery after remove", async () => {
    const first = new LocalDatabase({storageKey: "shared"});
    const second = new LocalDatabase({storageKey: "shared"});
    const one = vi.fn(), two = vi.fn(), removed = vi.fn();
    const a = first.addEventListener(collection, {onChange: one});
    const b = second.addEventListener(collection, {onChange: two});
    first.addEventListener(collection, {onChange: removed}).remove();
    await vi.waitFor(() => expect(two).toHaveBeenCalledOnce());
    a.remove();a.remove();
    await first.create([...collection, "id"], {score: 1});
    expect(one).toHaveBeenCalledOnce();
    expect(two).toHaveBeenCalledTimes(2);
    expect(removed).not.toHaveBeenCalled();
    b.remove();
});

it("keeps named record paths distinct and accepts Firebase-style string addresses", async () => {
    const database = new LocalDatabase({storageKey: "paths-listeners"});
    const named = vi.fn(), other = vi.fn(), stringPath = vi.fn();
    const a = database.addEventListener(record("a"), {onChange: named});
    const b = database.addEventListener(["meta", {other_id: "a", _: true}], {onChange: other});
    const c = database.addEventListener("meta/a", {onChange: stringPath});
    await vi.waitFor(() => expect(stringPath).toHaveBeenCalledOnce());
    await database.update(record("a"), () => ({name: "one"}));
    expect(named).toHaveBeenLastCalledWith(created({name: "one"}));
    expect(other).toHaveBeenCalledOnce();
    expect(stringPath).toHaveBeenLastCalledWith(created({name: "one"}));
    a.remove();b.remove();c.remove();
});

it("reports registration, storage and callback errors through the public onError contract", async () => {
    const onError = vi.fn();
    const database = new LocalDatabase({storageKey: "errors-listeners", onError});
    expect(database.addEventListener(collection, {onChildAdd: true})).toHaveProperty("remove");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}), "addEventListener", {path: collection});
    const failure = new Error("IndexedDB unavailable");
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw failure; });
    const failed = database.addEventListener(collection, {onChange: vi.fn()});
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure, "addEventListener", {path: collection, orderBy: undefined}));
    failed.remove();
    vi.restoreAllMocks();
    const callbackFailure = new Error("callback");
    const listener = database.addEventListener(collection, {onChange: () => { throw callbackFailure; }});
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(callbackFailure, "addEventListener.onChange", {path: collection, value: undefined}));
    listener.remove();
});

it("notifies listeners once after batch commit and never for a rolled-back batch", async () => {
    const database = new LocalDatabase({storageKey: "batch-listeners"});
    const onChange = vi.fn();
    const listener = database.addEventListener(collection, {onChange});
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    await database.update(new Map([[record("a"), {score: 1}], [record("b"), {score: 2}]]));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({a: created({score: 1}), b: created({score: 2})});
    await expect(database.update(new Map([[record("a"), {score: 3}], ["records/b/bad", undefined]])))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(onChange).toHaveBeenCalledTimes(2);
    listener.remove();
});

it("publishes a complete settings collection only after commit and stays silent on abort", async () => {
    const database = new LocalDatabase({storageKey: "settings-listeners"});
    const settings = ["meta", "settings"];
    const onChange = vi.fn();
    const listener = database.addEventListener(settings, {onChange});
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    await database.update(settings, () => ({theme: {value: "dark"}, locale: {value: "en"}}));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({theme: created({value: "dark"}), locale: created({value: "en"})});
    await expect(database.update(new Map([[settings, {theme: {value: "light"}}],
        [["meta", {record_id: "bad", _: true}], {bad: () => "cannot clone"}]])))
        .rejects.toBeInstanceOf(Error);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(await database.readSubtree(settings)).toEqual({theme: created({value: "dark"}), locale: created({value: "en"})});
    await database.update(settings, {locale: null});
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith({theme: created({value: "dark"})});
    listener.remove();
});

it.each([{orderBy: ""}, {orderBy: []}])("orders root values for Local listeners: %j", async ({orderBy}) => {
    const database = new LocalDatabase({storageKey: "root-order"});
    await database.update(record("a"), () => 3);
    await database.update(record("b"), () => 1);
    const onChildAdd = vi.fn();
    const listener = database.addEventListener(collection, {orderBy, onChildAdd});
    try {
        await vi.waitFor(() => expect(onChildAdd).not.toHaveBeenCalled());
        await database.update(record("c"), () => 0);
        expect(onChildAdd).toHaveBeenCalledOnce();
        await database.update(record("d"), () => 4);
        expect(onChildAdd.mock.calls.at(-1)[0]).toEqual({key: "d", value: 4});
    } finally { listener.remove(); }
});

it("uses numeric key order, ignores older additions, and observes writes queued during subscription", async () => {
    const database = new LocalDatabase({storageKey: "key-boundary"});
    await database.update(record("2"), () => 1);
    await database.update(record("10"), () => 1);
    const added = vi.fn();
    const listener = database.addEventListener(collection, {onChildAdd: added});
    await database.update(record("11"), () => 2);
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "11", value: 2});
    await database.update(record("9"), () => 3);
    await database.delete(record("10"));
    await database.update(record("10"), () => 4);
    expect(added).toHaveBeenCalledOnce();
    listener.remove();
    await database.update(record("12"), () => 5);
    expect(added).toHaveBeenCalledOnce();
});

it("uses signed and padded numeric key ordering for the addition boundary", async () => {
    const database = new LocalDatabase({storageKey: "numeric-boundary"});
    await database.update(record("-2"), () => true);
    await database.update(record("2"), () => true);
    const added = vi.fn();
    const listener = database.addEventListener(collection, {onChildAdd: added});
    await database.update(record("02"), () => true);
    await database.update(record("-1"), () => true);
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "02", value: true});
    listener.remove();
});

it("emits the first child for an empty collection without an initial replay", async () => {
    const database = new LocalDatabase({storageKey: "empty-boundary"});
    const added = vi.fn();
    const listener = database.addEventListener(collection, {onChildAdd: added});
    await database.update(record("a"), () => ({score: 1}));
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "a", value: created({score: 1})});
    listener.remove();
});
