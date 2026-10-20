import {vi} from "vitest";
import FirebaseDatabase from "../../firebase";
import DatabaseBase from "../../common/DatabaseBase";
import {DatabaseOrder} from "../../common/DatabaseOrder";
import {createFirebase} from "../fixtures/firebase";

let database, fixture, sdk;
beforeEach(() => {
    fixture = createFirebase();
    sdk = fixture.sdk;
    database = new FirebaseDatabase({firebase: fixture.firebase});
});

it("exports the same order enum through the base and source entrypoints", async () => {
    expect((await import("../../common/DatabaseBase")).DatabaseOrder).toBe(DatabaseOrder);
    expect((await import("../../index")).DatabaseOrder).toBe(DatabaseOrder);
    expect(database).toBeInstanceOf(DatabaseBase);
    expect(database.TIMESTAMP).toBe(fixture.firebase.database.ServerValue.TIMESTAMP);
    expect(database.increment(-2)).toEqual({".sv": {increment: -2}});
});
it.each(["users/a", ["users", "a"], "", []])("normalizes read/write/delete path %j", async path => {
    const effective = path instanceof Array ? path.join("/") : path;
    sdk.once.mockResolvedValue(fixture.snapshot({name: "A"}));
    expect(await database.read(path)).toEqual({name: "A"});
    expect(sdk.once.mock.calls[0][0].path).toBe(effective);
    await expect(database.write(path, false)).resolves.toBeUndefined();
    await expect(database.delete(path)).resolves.toBeUndefined();
    expect(sdk.set.mock.calls.map(([ref, value]) => [ref.path, value])).toEqual([[effective, false], [effective, null]]);
});
it("returns undefined for an absent node and preserves false/zero values", async () => {
    expect(await database.read("missing")).toBeUndefined();
    for (const value of [false, 0, ""]) {
        sdk.once.mockResolvedValue(fixture.snapshot(value));
        expect(await database.read("value")).toBe(value);
    }
});
it("reads matching values and selects the last ordered value only without equalTo", async () => {
    await database.read("records", {orderBy: "score"});
    expect(sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["score"], limitToLast: [1]});
    await database.read("records", {orderBy: "flag", equalTo: false});
    expect(sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["flag"], equalTo: [false]});
});
it("rejects undefined writes without contacting Firebase", async () => {
    await expect(database.write("records/a", undefined)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(sdk.set).not.toHaveBeenCalled();
});
it("updates fields at a path and supports root-relative object/Map batches", async () => {
    await database.update(["records", "a"], {name: "new", obsolete: null});
    await database.update({"records/b/name": "B"});
    await database.update(new Map([[["records", "c", "name"], "C"]]));
    expect(sdk.update.mock.calls.map(([ref, value]) => [ref.path, value])).toEqual([
        ["records/a", {name: "new", obsolete: null}], ["", {"records/b/name": "B"}], ["", {"records/c/name": "C"}],
    ]);
    for (const path of ["records/a", ["records", "a"]]) {
        await expect(database.update(path)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(sdk.update).toHaveBeenCalledTimes(3);
});
it("prepares a draft without writing and saves by generated key without reading or transacting", async () => {
    const draft = database.create(["records"]);
    expect(draft.temporaryKey).toBe("generated-1");
    expect(sdk.set).not.toHaveBeenCalled();
    expect(await draft.save({name: "A"})).toBe(draft.temporaryKey);
    expect(sdk.set.mock.calls.map(([ref, value]) => [ref.path, value])).toEqual([
        ["records/generated-1", {name: "A"}]
    ]);
    expect(sdk.once).not.toHaveBeenCalled();
    expect(sdk.transaction).not.toHaveBeenCalled();
});
it.each([undefined, null, "value", 1, false, []])("rejects invalid draft value %j", async value => {
    await expect(database.create("records").save(value)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(sdk.transaction).not.toHaveBeenCalled();
    expect(sdk.set).not.toHaveBeenCalled();
});
it("allows retry after a rejected draft save", async () => {
    const draft = database.create("records");
    sdk.set.mockRejectedValueOnce(new Error("offline"));
    await expect(draft.save({name: "A"})).rejects.toThrow("offline");
    expect(await draft.save({name: "A"})).toBe(draft.temporaryKey);
});
it("throws by default and reports effective operation errors once with context", async () => {
    const error = new Error("offline"), onError = vi.fn(), override = vi.fn();
    sdk.set.mockRejectedValue(error);
    await expect(database.write("records/a", 1)).rejects.toBe(error);
    const handled = new FirebaseDatabase({firebase: fixture.firebase, onError});
    await expect(handled.write("records/a", 2)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "write", {path: "records/a", value: 2});
    await handled.delete("records/a", {onError: override});
    expect(override).toHaveBeenCalledExactlyOnceWith(error, "delete", {path: "records/a"});
    expect(onError).toHaveBeenCalledTimes(1);
    sdk.update.mockRejectedValue(error);
    override.mockClear();
    const updates = {"records/a": 1};
    await handled.update(updates, {onError: override});
    expect(override).toHaveBeenCalledExactlyOnceWith(error, "update", {updates});
});
it("reports factory, draft and error-handler failures without recursive handling", async () => {
    const onError = vi.fn();
    const draft = database.create("records", {onError});
    await draft.save(undefined);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}), "create.save", {path: "records", value: undefined});
    const failure = new Error("handler failed");
    sdk.once.mockRejectedValue(new Error("read failed"));
    const handler = vi.fn(() => { throw failure; });
    await expect(database.read("records", {onError: handler})).rejects.toBe(failure);
    expect(handler).toHaveBeenCalledTimes(1);
});
