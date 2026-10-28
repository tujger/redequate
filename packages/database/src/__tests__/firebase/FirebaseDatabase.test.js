import {vi} from "vitest";
import FirebaseDatabase from "../../firebase";
import DatabaseBase from "../../common/DatabaseBase";
import {DatabaseOrder} from "../../common/DatabaseOrder";
import {createFirebase} from "../fixtures/firebase";
import {createBackend} from "../fixtures/backend";

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

let database, fixture, sdk, backend;
beforeEach(() => {
    fixture = createFirebase();
    sdk = fixture.sdk;
    backend = createBackend();
    database = new FirebaseDatabase({firebase: fixture.firebase, backend});
});

it("exports the same order enum through the base and source entrypoints", async () => {
    expect((await import("../../common/DatabaseBase")).DatabaseOrder).toBe(DatabaseOrder);
    expect((await import("../../index")).DatabaseOrder).toBe(DatabaseOrder);
    expect(database).toBeInstanceOf(DatabaseBase);
    expect(database.TIMESTAMP).toEqual({".sv": "timestamp"});
    expect(database).not.toHaveProperty("increment");
});
it("keeps the Local schema API out of the shared and Firebase providers", () => {
    expect(new DatabaseBase()).not.toHaveProperty("applySchema");
    expect(database).not.toHaveProperty("applySchema");
});
it.each(["users/a", ["users", "a"]])("distinguishes an array identity-field read from literal update/delete paths %j", async path => {
    const effective = path instanceof Array ? path.join("/") : path;
    sdk.once.mockResolvedValue(fixture.snapshot({name: "A"}));
    expect(await database.read(path)).toEqual({name: "A"});
    expect(sdk.once.mock.calls[0][0].path).toBe(Array.isArray(path) ? "users" : effective);
    await expect(database.update(path, () => false)).resolves.toBe(false);
    await expect(database.delete(path)).resolves.toBeUndefined();
    expect(backend.request).toHaveBeenCalledWith("database.update", effective, false, {mode: "replace", etag: "initial"});
    expect(backend.request).toHaveBeenLastCalledWith("database.delete", effective);
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
it("throws by default and reports effective operation errors once with context", async () => {
    const error = new Error("offline"), onError = vi.fn(), override = vi.fn();
    backend.request.mockRejectedValue(error);
    await expect(database.update("records/a", () => 1)).rejects.toBe(error);
    const handled = new FirebaseDatabase({firebase: fixture.firebase, backend, onError});
    await expect(handled.update("records/a", () => 2)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "update", {path: "records/a", changes: expect.any(Function)});
    await handled.delete("records/a", {onError: override});
    expect(override).toHaveBeenCalledExactlyOnceWith(error, "delete", {path: "records/a"});
    expect(onError).toHaveBeenCalledTimes(1);
    override.mockClear();
    const updates = {"records/a": 1};
    await handled.update(updates, {onError: override});
    expect(override).toHaveBeenCalledExactlyOnceWith(error, "update", {updates});
});
it("reports create and error-handler failures without recursive handling", async () => {
    const onError = vi.fn();
    const handled = new FirebaseDatabase({firebase: fixture.firebase, backend, onError});
    await expect(handled.create(["records", "record_id"], undefined)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}), "create", {path: ["records", "record_id"], value: undefined});
    const failure = new Error("handler failed");
    sdk.once.mockRejectedValue(new Error("read failed"));
    const handler = vi.fn(() => { throw failure; });
    await expect(database.read("records", {onError: handler})).rejects.toBe(failure);
    expect(handler).toHaveBeenCalledTimes(1);
});
