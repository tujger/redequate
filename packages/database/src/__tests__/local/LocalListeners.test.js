import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const collection = ["records"];
const record = key => ["records", {record_id: key, _: true}];
const created = value => ({...value, timestamp: expect.any(Number)});

it.each([
    {orderBy: ["details", "score"], last: "a"},
    {orderBy: ["details", {field: "score", _: 0}], last: "a"},
    {orderBy: "details/score", last: "b"}
])("orders child additions by ready field segments: %j", async ({orderBy, last}) => {
    const database = new LocalDatabase({storageKey: "field-order"});
    await database.write(record("a"), {details: {score: 2}, "details/score": 1});
    await database.write(record("b"), {details: {score: 1}, "details/score": 2});
    const onChildAdd = vi.fn();
    const listener = database.addEventListener(collection, {orderBy, onChildAdd});
    try {
        await vi.waitFor(() => expect(onChildAdd).toHaveBeenCalledOnce());
        expect(onChildAdd.mock.calls[0][0].key).toBe(last);
        await database.write(record("c"), {details: {score: 3}, "details/score": 3});
        expect(onChildAdd.mock.calls.at(-1)[0].key).toBe("c");
    } finally { listener.remove(); }
});

it("delivers initial value and last ordered child, then CRUD events with Firebase payloads", async () => {
    const database = new LocalDatabase({storageKey: "events"});
    await database.write(record("a"), {score: 1});
    await database.write(record("b"), {score: 2});
    const onChange = vi.fn(), onChildAdd = vi.fn(), onChildChange = vi.fn(), onChildRemove = vi.fn();
    const listener = database.addEventListener(collection, {onChange, onChildAdd, onChildChange, onChildRemove, orderBy: "score"});
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith({a: created({score: 1}), b: created({score: 2})});
    expect(onChildAdd).toHaveBeenCalledExactlyOnceWith({key: "b", value: created({score: 2})});
    await database.write(record("c"), {score: 3});
    expect(onChildAdd).toHaveBeenLastCalledWith({key: "c", value: created({score: 3})});
    await database.update(record("a"), {score: 4});
    expect(onChildChange).toHaveBeenLastCalledWith({key: "a", value: created({score: 4})});
    expect(onChildAdd).toHaveBeenLastCalledWith({key: "a", value: created({score: 4})});
    await database.delete(record("a"));
    expect(onChildRemove).toHaveBeenLastCalledWith({key: "a", value: created({score: 4})});
    expect(onChildAdd).toHaveBeenLastCalledWith({key: "c", value: created({score: 3})});
    listener.remove();
});

it("watches records and fields, including creation, replacement and deletion", async () => {
    const database = new LocalDatabase({storageKey: "fields-listeners"});
    const recordValue = vi.fn(), fieldValue = vi.fn(), childChange = vi.fn(), childRemove = vi.fn();
    const a = database.addEventListener(record("a"), {onChange: recordValue, onChildChange: childChange, onChildRemove: childRemove});
    const b = database.addEventListener([...record("a"), "name"], {onChange: fieldValue});
    await vi.waitFor(() => expect(fieldValue).toHaveBeenCalledWith(undefined));
    await database.write(record("a"), {name: "first", kept: true});
    await database.write([...record("a"), "name"], "second");
    expect(fieldValue).toHaveBeenLastCalledWith("second");
    expect(childChange).toHaveBeenCalledWith({key: "name", value: "second"});
    await database.delete([...record("a"), "kept"]);
    expect(childRemove).toHaveBeenCalledWith({key: "kept", value: true});
    await database.write(record("a"), null);
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
    const draft = first.create(collection);
    await draft.save({score: 1});
    expect(one).toHaveBeenCalledOnce();
    expect(two).toHaveBeenCalledTimes(2);
    expect(removed).not.toHaveBeenCalled();
    b.remove();
});

it("keeps named record paths distinct and accepts Firebase-style string addresses", async () => {
    const database = new LocalDatabase({storageKey: "paths-listeners"});
    const named = vi.fn(), other = vi.fn(), stringPath = vi.fn();
    const a = database.addEventListener(record("a"), {onChange: named});
    const b = database.addEventListener(["records", {other_id: "a", _: true}], {onChange: other});
    const c = database.addEventListener("records/a", {onChange: stringPath});
    await vi.waitFor(() => expect(stringPath).toHaveBeenCalledOnce());
    await database.write(record("a"), {name: "one"});
    expect(named).toHaveBeenLastCalledWith(created({name: "one"}));
    expect(other).toHaveBeenCalledOnce();
    expect(stringPath).toHaveBeenLastCalledWith(created({name: "one"}));
    a.remove();b.remove();c.remove();
});

it("reports registration, storage and callback errors through the public onError contract", async () => {
    const onError = vi.fn();
    const database = new LocalDatabase({storageKey: "errors-listeners", onError});
    expect(database.addEventListener(collection, {onChildAdd: true})).toBeUndefined();
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
    await database.write(settings, {theme: {value: "dark"}, locale: {value: "en"}});
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({theme: created({value: "dark"}), locale: created({value: "en"})});
    await expect(database.update(new Map([[settings, {theme: {value: "light"}}],
        [["records", {record_id: "bad", _: true}], {bad: () => "cannot clone"}]])))
        .rejects.toBeInstanceOf(Error);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(await database.read(settings)).toEqual({theme: created({value: "dark"}), locale: created({value: "en"})});
    await database.update(settings, {locale: null});
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith({theme: created({value: "dark"})});
    listener.remove();
});

it.each([{orderBy: ""}, {orderBy: []}])("orders root values for Local listeners: %j", async ({orderBy}) => {
    const database = new LocalDatabase({storageKey: "root-order"});
    await database.write(record("a"), 3);
    await database.write(record("b"), 1);
    const onChildAdd = vi.fn();
    const listener = database.addEventListener(collection, {orderBy, onChildAdd});
    try {
        await vi.waitFor(() => expect(onChildAdd).toHaveBeenCalledOnce());
        expect(onChildAdd.mock.calls[0][0]).toEqual({key: "a", value: 3});
        await database.write(record("c"), 0);
        expect(onChildAdd).toHaveBeenCalledOnce();
        await database.write(record("d"), 4);
        expect(onChildAdd.mock.calls.at(-1)[0]).toEqual({key: "d", value: 4});
    } finally { listener.remove(); }
});
