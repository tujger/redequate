import {vi} from "vitest";
import AuthBase from "../../../packages/auth/src/AuthBase";
import {createDatabase} from "../../../packages/auth/src/__tests__/fixtures/database";
import UserData from "../../controllers/UserData";

const put = (database, id, role = null) => database.update(new Map([
    [["users_public", {user_id: id}], {name: id}],
    [["roles", {user_id: id}], role]
]));

it("blocks removing, disabling, or deleting the sole active ADMIN", async () => {
    const database = createDatabase();
    await put(database, "one", "admin");
    await expect(new UserData(database).create("one").updateRole(null)).rejects.toMatchObject({code: "auth/last-admin"});
    await expect(new UserData(database).create("one").updateRole("disabled")).rejects.toMatchObject({code: "auth/last-admin"});
    await expect(new UserData(database).create("one").delete()).rejects.toMatchObject({code: "auth/last-admin"});
    expect(await database.read(["roles", {user_id: "one"}])).toBe("admin");
    expect(await database.read(["users_public", {user_id: "one"}])).toBeDefined();
});

it("permits a change when another active ADMIN remains", async () => {
    const database = createDatabase();
    database.delete = async path => database.update(new Map([[path, null]]));
    await put(database, "one", "admin");
    await put(database, "two", "admin");
    await new UserData(database).create("one").updateRole("disabled");
    expect(await database.read(["roles", {user_id: "one"}])).toBe("disabled");
    await new UserData(database).create("one").delete();
    await expect(new UserData(database).create("two").updateRole(null)).rejects.toMatchObject({code: "auth/last-admin"});
});

it("does not count an orphaned admin role as an active ADMIN", async () => {
    const database = createDatabase();
    await put(database, "one", "admin");
    await database.update(new Map([[["roles", {user_id: "orphan"}], "admin"]]));
    await expect(new UserData(database).create("one").delete()).rejects.toMatchObject({code: "auth/last-admin"});
});

it("rejects the whole profile batch when a role change would remove the last administrator", async () => {
    const database = createDatabase();
    await put(database, "one", "admin");
    database.update.mockClear();
    const updates = new Map([[["users_public", {user_id: "one"}, "emailVerified"], false]]);
    await expect(new UserData(database).create("one").updateRole(null, updates))
        .rejects.toMatchObject({code: "auth/last-admin"});
    expect(database.update).not.toHaveBeenCalled();
    expect(updates.size).toBe(1);
});

describe.each([
    ["UserData.updateRole", (database, id) => new UserData(database).create(id).updateRole(null)],
    ["UserData.delete", (database, id) => new UserData(database).create(id).delete()],
    ["AuthBase profile update", (database, id) => new AuthBase({database})._saveProfile({id}, {role: null})]
])("%s administrator lookup", (_, change) => {
    it("reads only ADMIN candidates and stops at the first existing public profile", async () => {
        const database = createDatabase();
        database.delete = vi.fn().mockResolvedValue();
        await put(database, "current", "admin");
        await put(database, "ordinary", "disabled");
        await database.update(new Map([[["roles", {user_id: "orphan"}], "admin"]]));
        await put(database, "active", "admin");
        await put(database, "unneeded", "admin");
        await change(database, "current");
        expect(database.read.mock.calls).toEqual([
            [["roles", {user_id: "current"}]],
            [["roles"], {equalTo: "admin"}],
            [["users_public", {user_id: "orphan"}]],
            [["users_public", {user_id: "active"}]]
        ]);
    });

    it("rejects an orphan-only result without writing changes", async () => {
        const database = createDatabase();
        database.delete = vi.fn().mockResolvedValue();
        await put(database, "current", "admin");
        await database.update(new Map([[["roles", {user_id: "orphan"}], "admin"]]));
        database.update.mockClear();
        await expect(change(database, "current")).rejects.toMatchObject({code: "auth/last-admin"});
        expect(database.read.mock.calls).toEqual([
            [["roles", {user_id: "current"}]],
            [["roles"], {equalTo: "admin"}],
            [["users_public", {user_id: "orphan"}]]
        ]);
        expect(database.update).not.toHaveBeenCalled();
        expect(database.delete).not.toHaveBeenCalled();
    });

    it("does not fetch candidates when the current user is not ADMIN", async () => {
        const database = createDatabase();
        database.delete = vi.fn().mockResolvedValue();
        await put(database, "ordinary");
        await change(database, "ordinary");
        expect(database.read.mock.calls).toEqual([[["roles", {user_id: "ordinary"}]]]);
    });
});
