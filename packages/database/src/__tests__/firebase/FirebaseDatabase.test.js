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
it.each(["users/a", ["users", "a"]])("normalizes read/update/delete path %j", async path => {
    const effective = path instanceof Array ? path.join("/") : path;
    sdk.once.mockResolvedValue(fixture.snapshot({name: "A"}));
    expect(await database.read(path)).toEqual({name: "A"});
    expect(sdk.once.mock.calls[0][0].path).toBe(effective);
    await expect(database.update(path, () => false)).resolves.toBe(false);
    await expect(database.delete(path)).resolves.toBeUndefined();
    expect(sdk.transaction.mock.calls[0][0].path).toBe(effective);
    expect(sdk.set.mock.calls.map(([ref, value]) => [ref.path, value])).toEqual([[effective, null]]);
});
it.each(["", []])("rejects root reads without changing root update/delete paths %j", async path => {
    await expect(database.read(path)).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.read(path, {onError: vi.fn()}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.update(path, () => false)).resolves.toBe(false);
    await expect(database.delete(path)).resolves.toBeUndefined();
});
it("returns undefined for an absent node and preserves false/zero values", async () => {
    expect(await database.read("missing")).toBeUndefined();
    for (const value of [false, 0, ""]) {
        sdk.once.mockResolvedValue(fixture.snapshot(value));
        expect(await database.read("value")).toBe(value);
    }
});
it("reads all ordered values and applies equality", async () => {
    await database.read("records", {orderBy: "score"});
    expect(sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["score"]});
    await database.read("records", {orderBy: "flag", equalTo: false});
    expect(sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["flag"], equalTo: [false]});
});
it("deletes on undefined callback results", async () => {
    expect(await database.update("records/a", () => undefined)).toBeNull();
    expect(sdk.transaction).toHaveBeenCalledOnce();
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
it("creates transactionally and returns the permanent key", async () => {
    const key = await database.create(["records", "record_id"], {name: "A"});
    expect(key).toBe("generated-1");
    expect(sdk.set).not.toHaveBeenCalled();
    expect(sdk.transaction.mock.calls[0][0].path).toBe("records/generated-1");
    expect(sdk.values.get("records/generated-1")).toEqual({name: "A"});
});
it.each([undefined, null, "value", 1, false, []])("rejects invalid create value %j", async value => {
    await expect(database.create(["records", "record_id"], value)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(sdk.transaction).not.toHaveBeenCalled();
    expect(sdk.set).not.toHaveBeenCalled();
});
it("allows another create after a rejected write", async () => {
    sdk.transaction.mockRejectedValueOnce(new Error("offline"));
    await expect(database.create(["records", "record_id"], {name: "A"})).rejects.toThrow("offline");
    expect(await database.create(["records", "record_id"], {name: "A"})).toBe("generated-2");
});
it("throws by default and reports effective operation errors once with context", async () => {
    const error = new Error("offline"), onError = vi.fn(), override = vi.fn();
    sdk.transaction.mockRejectedValue(error);
    await expect(database.update("records/a", () => 1)).rejects.toBe(error);
    const handled = new FirebaseDatabase({firebase: fixture.firebase, onError});
    await expect(handled.update("records/a", () => 2)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "update", {path: "records/a", changes: expect.any(Function)});
    sdk.set.mockRejectedValue(error);
    await handled.delete("records/a", {onError: override});
    expect(override).toHaveBeenCalledExactlyOnceWith(error, "delete", {path: "records/a"});
    expect(onError).toHaveBeenCalledTimes(1);
    sdk.update.mockRejectedValue(error);
    override.mockClear();
    const updates = {"records/a": 1};
    await handled.update(updates, {onError: override});
    expect(override).toHaveBeenCalledExactlyOnceWith(error, "update", {updates});
});
it("reports create and error-handler failures without recursive handling", async () => {
    const onError = vi.fn();
    const handled = new FirebaseDatabase({firebase: fixture.firebase, onError});
    await expect(handled.create(["records", "record_id"], undefined)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}), "create", {path: ["records", "record_id"], value: undefined});
    const failure = new Error("handler failed");
    sdk.once.mockRejectedValue(new Error("read failed"));
    const handler = vi.fn(() => { throw failure; });
    await expect(database.read("records", {onError: handler})).rejects.toBe(failure);
    expect(handler).toHaveBeenCalledTimes(1);
});
