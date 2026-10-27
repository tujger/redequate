import createLocalDatabase from "../../../packages/database/src/__tests__/createLocalDatabase";
import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";

import {readNativeStore} from "../../../packages/database/src/__tests__/createLocalDatabase";
import UserData from "../../controllers/UserData";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const user = ["users_public", {user_id: "u1"}];
const email = [...user, {email: "email"}];
const created = value => value;

it("saves profile fields under their query names and reads the complete profile", async () => {
    const database = createLocalDatabase({storageId: "profile-fields"});
    const profile = new UserData(database).create("u1", {name: " User ", email: "a@b.com", updated: 1});
    await profile.setPrivate("phone", {locale: "en", enabled: true});
    await profile.save();
    expect(await database.read(user)).toMatchObject({name: "User", email: "a@b.com", updated: expect.any(Number)});
    expect(await database.read(email)).toBe("a@b.com");
    expect(await database.read([...user, {email: "email"}])).toBe("a@b.com");
    const phone = ["users_private", {user_id: "u1"}, {device_id: "phone"}];
    expect(await database.read([...phone, {locale: "locale"}])).toBe("en");
    expect(await database.read(["users_private", {user_id: "u1"}])).toEqual({_id: 1, user_id: "u1", phone: created({locale: "en", enabled: true})});
    const rows = await readNativeStore("profile-fields", "users_public");
    expect(rows[0]).toMatchObject({user_id: "u1", email: "a@b.com", name: "User"});
    expect(rows.every(row => !Object.hasOwn(row, "_local"))).toBe(true);
});


it("changes and loads Local roles while keeping an active administrator", async () => {
    const database = createLocalDatabase({storageId: "user-local-roles"});
    const one = new UserData(database).create("one", {name: "One"});
    const two = new UserData(database).create("two", {name: "Two"});
    await one.save();
    await one.updateRole("admin");
    await expect(one.updateRole(null)).rejects.toMatchObject({code: "auth/last-admin"});
    await expect(one.delete()).rejects.toMatchObject({code: "auth/last-admin"});
    await two.save();
    await two.updateRole("admin");
    await one.updateRole("disabled");
    const loaded = await new UserData(database).fetch("one", [UserData.ROLE]);
    expect(loaded.role).toBe("disabled");
    await one.updateRole(null);
    expect(await database.read(["roles", {user_id: "one"}])).toBeUndefined();
    await expect(two.updateRole("disabled")).rejects.toMatchObject({code: "auth/last-admin"});
});
