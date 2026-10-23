import {createDatabase} from "../fixtures/database";
import {assertAdminRemains, deleteUserProfile, saveInitialProfile, updateUserRole} from "../../common/adminPolicy";

const put = (database, id, role = null) => database.update(new Map([
    [["users_public", {user_id: id}], {name: id}],
    [["roles", {user_id: id}], role]
]));

it("bootstraps only the first user, including after the first role is removed", async () => {
    const database = createDatabase();
    const user = id => ({id, public: {name: id}, private: {}});
    await saveInitialProfile(user("one"), database, true);
    expect(await database.read(["roles", {user_id: "one"}])).toBe("admin");
    await database.update(new Map([[["roles", {user_id: "one"}], null]]));
    await saveInitialProfile(user("two"), database, true);
    expect(await database.read(["roles", {user_id: "two"}])).toBeUndefined();
});

it("blocks removing, disabling, or deleting the sole active ADMIN", async () => {
    const database = createDatabase();
    await put(database, "one", "admin");
    await expect(updateUserRole(database, "one", null)).rejects.toMatchObject({code: "auth/last-admin"});
    await expect(updateUserRole(database, "one", "disabled")).rejects.toMatchObject({code: "auth/last-admin"});
    await expect(deleteUserProfile(database, "one")).rejects.toMatchObject({code: "auth/last-admin"});
    expect(await database.read(["roles", {user_id: "one"}])).toBe("admin");
    expect(await database.read(["users_public", {user_id: "one"}])).toBeDefined();
});

it("permits a change when another active ADMIN remains", async () => {
    const database = createDatabase();
    database.delete = async path => database.update(new Map([[path, null]]));
    await put(database, "one", "admin");
    await put(database, "two", "admin");
    await updateUserRole(database, "one", "disabled");
    expect(await database.read(["roles", {user_id: "one"}])).toBe("disabled");
    await deleteUserProfile(database, "one");
    await expect(assertAdminRemains(database, "two")).rejects.toMatchObject({code: "auth/last-admin"});
});

it("does not count an orphaned admin role as an active ADMIN", async () => {
    const database = createDatabase();
    await put(database, "one", "admin");
    await database.update(new Map([[["roles", {user_id: "orphan"}], "admin"]]));
    await expect(deleteUserProfile(database, "one")).rejects.toMatchObject({code: "auth/last-admin"});
});
