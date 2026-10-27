import createLocalDatabase from "../../../../database/src/__tests__/createLocalDatabase";
import {vi} from "vitest";
import {UserData} from "../../../../common";

import {createDatabase} from "../fixtures/database";
import AuthBase from "../../AuthBase";

const identity = id => new UserData().create(id, {name: id, email: `${id}@example.test`});
const denied = () => Object.assign(new Error("Access denied"), {code: "PERMISSION_DENIED"});

it("saves the first profile and ADMIN together and updates the model after acknowledgement", async () => {
    const database = createDatabase();
    const user = identity("one");
    const auth = new AuthBase({database});
    const save = database.update.getMockImplementation();
    database.update.mockImplementation(async (...args) => {
        expect(user.role).not.toBe("admin");
        await save(...args);
    });
    await auth._saveInitialProfile(user);
    expect(database.cursor).toHaveBeenCalledWith(["users_public", "user_id"], {onError: expect.any(Function)});
    expect(database.update).toHaveBeenCalledTimes(1);
    expect([...database.update.mock.calls[0][0]]).toEqual(expect.arrayContaining([
        [["roles", {user_id: user.id}], "admin"],
        [["users_public", {user_id: user.id}, "name"], "one"]
    ]));
    expect(user.role).toBe("admin");
    expect(user.persisted).toBe(true);
});

it("saves an ordinary profile when another public profile exists", async () => {
    const database = createDatabase();
    await database.update(new Map([[["users_public", {user_id: "existing"}], {name: "Existing"}]]));
    const user = identity("new");
    await new AuthBase({database})._saveInitialProfile(user);
    expect(await database.read(["roles", {user_id: user.id}])).toBeUndefined();
    expect(user.role).not.toBe("admin");
});

it("leaves an existing profile and role unchanged", async () => {
    const database = createDatabase();
    await database.update(new Map([
        [["users_public", {user_id: "one"}], {name: "Stored"}],
        [["roles", {user_id: "one"}], "disabled"]
    ]));
    database.update.mockClear();
    await new AuthBase({database})._saveInitialProfile(identity("one"));
    expect(database.cursor).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
});

it.each(["PERMISSION_DENIED", "permission-denied", "database/permission-denied"])(
    "retries without ADMIN after %s and preserves profile fields", async code => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
        const database = createDatabase();
        database.update.mockRejectedValueOnce(Object.assign(denied(), {code}));
        const user = identity("one");
        await new AuthBase({database})._saveInitialProfile(user);
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("Initial ADMIN write denied"), code);
        expect(database.update).toHaveBeenCalledTimes(2);
        const first = [...database.update.mock.calls[0][0]];
        const second = [...database.update.mock.calls[1][0]];
        expect(second).toEqual(first.filter(([path]) => path[0] !== "roles"));
        expect(user.role).not.toBe("admin");
        expect(user.persisted).toBe(true);
        expect(await database.read(["roles", {user_id: user.id}])).toBeUndefined();
    }
);

it.each(["read", "cursor"])("saves normally if %s cannot establish that profiles are absent", async operation => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const database = createDatabase();
    if (operation === "read") database.read.mockRejectedValueOnce(denied());
    else database.cursor.mockReturnValueOnce({next: vi.fn().mockRejectedValue(denied())});
    const user = identity("one");
    await new AuthBase({database})._saveInitialProfile(user);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Initial ADMIN check denied"), "PERMISSION_DENIED");
    expect(database.update).toHaveBeenCalledTimes(1);
    expect([...database.update.mock.calls[0][0]].some(([path]) => path[0] === "roles")).toBe(false);
});

it.each(["read", "cursor", "update"])("propagates non-permission %s errors without retrying", async operation => {
    const database = createDatabase();
    const failure = new Error("Storage unavailable");
    if (operation === "cursor") database.cursor.mockReturnValueOnce({next: vi.fn().mockRejectedValue(failure)});
    else database[operation].mockRejectedValueOnce(failure);
    const user = identity("one");
    await expect(new AuthBase({database})._saveInitialProfile(user)).rejects.toBe(failure);
    expect(database.update).toHaveBeenCalledTimes(operation === "update" ? 1 : 0);
    expect(user.role).not.toBe("admin");
});

it("propagates failure of the ordinary-profile fallback", async () => {
    const database = createDatabase();
    const failure = new Error("Fallback failed");
    database.update.mockRejectedValueOnce(denied()).mockRejectedValueOnce(failure);
    const user = identity("one");
    await expect(new AuthBase({database})._saveInitialProfile(user)).rejects.toBe(failure);
    expect(user.role).not.toBe("admin");
    expect(user.persisted).not.toBe(true);
});

it("does not swallow provider errors through a permissive global database handler", async () => {
    const failure = new Error("IndexedDB failed");
    const onError = vi.fn();
    const database = createLocalDatabase({storageId: "bootstrap-strict-errors", onError});
    vi.spyOn(database, "update").mockImplementation(async (_, options) => options.onError(failure));
    await expect(new AuthBase({database})._saveInitialProfile(identity("one"))).rejects.toBe(failure);
    expect(onError).not.toHaveBeenCalled();
});

it("initializes a cleared real LocalDatabase despite a retained authentication identity", async () => {
    const database = createLocalDatabase({storageId: "bootstrap-reset-test"});
    const auth = new AuthBase({database});
    const first = identity("retained-account");
    await auth._saveInitialProfile(first);
    expect(await database.read(["roles", {user_id: first.id}])).toBe("admin");
    await database.delete(["users_public", {user_id: first.id}]);
    await database.delete(["roles", {user_id: first.id}]);
    const returning = identity(first.id);
    await auth._saveInitialProfile(returning);
    expect(returning.role).toBe("admin");
    const next = identity("next-account");
    await auth._saveInitialProfile(next);
    expect(next.role).not.toBe("admin");
});
