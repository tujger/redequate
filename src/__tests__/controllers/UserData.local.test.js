import createLocalDatabase from "../../../packages/database/src/__tests__/createLocalDatabase";
import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";

import {readNativeStore} from "../../../packages/database/src/__tests__/createLocalDatabase";
import UserData from "../../controllers/UserData";
import AuthBase from "../../../packages/auth/src/AuthBase";
import loadUserData from "../../../packages/auth/src/common/loadUserData";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const user = ["users_public", {user_id: "u1"}];
const email = [...user, {email: "email"}];
const created = value => value;

it("saves profile fields under their query names and reads the complete profile", async () => {
    const database = createLocalDatabase({storageId: "profile-fields"});
    await database.read(["posts"]);
    const profile = new UserData(database).create("u1", {name: " User ", email: "a@b.com", updated: 1});
    await profile.setPrivate("phone", {locale: "en", enabled: true});
    await profile.save();
    expect(await database.read(user)).toMatchObject({name: "User", email: "a@b.com", updated: expect.any(Number)});
    expect(await database.read(email)).toBe("a@b.com");
    expect(await database.read([...user, {email: "email"}])).toBe("a@b.com");
    const phone = ["users_private", {user_id: "u1"}, {device_id: "phone"}];
    expect(await database.read([...phone, {locale: "locale"}])).toBe("en");
    expect(await database.read(["users_private", {user_id: "u1"}])).toEqual({phone: created({locale: "en", enabled: true})});
    const rows = await readNativeStore("profile-fields", "users_public");
    expect(rows[0]).toMatchObject({user_id: "u1", email: "a@b.com", name: "User"});
    expect(rows.every(row => !Object.hasOwn(row, "_local"))).toBe(true);
});


it("uses scalar roles and protects the last active administrator through LocalDatabase", async () => {
    const database = createLocalDatabase({storageId: "local-user-roles"});
    await database.read(["posts"]);
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

it("loads an authenticated profile and saves private devices again without physical fields", async () => {
    const database = createLocalDatabase({storageId: "private-login-roundtrip"});
    await database.read(["posts"]);
    const auth = new AuthBase({database, UserData});
    const first = new UserData(database).create("retained-user", {name: "Original", email: "user@example.test"});
    await first.setPrivate("phone", {locale: "en", browserName: "Chrome"});
    await auth._saveInitialProfile(first);
    const signedIn = new UserData(database).create(first.id);
    await loadUserData(signedIn, database);
    expect(signedIn.private).toEqual({phone: {locale: "en", browserName: "Chrome"}});
    expect(signedIn.public).not.toHaveProperty("user_id");
    expect(signedIn.public).not.toHaveProperty("_id");
    await signedIn.setPrivate("desktop", {locale: "ru", browserName: " Safari "});
    await signedIn.savePrivate();
    const reloaded = await new UserData(database).fetch(first.id, [UserData.PRIVATE]);
    expect(reloaded.private).toEqual({
        phone: {locale: "en", browserName: "Chrome"},
        desktop: {locale: "ru", browserName: "Safari"}
    });
    expect(await database.read(["roles", {user_id: first.id}])).toBe("admin");
});

it("subscribes to posts by the indexed author field used by Home", async () => {
    const database = createLocalDatabase({storageId: "home-author-listener"});
    await database.read(["posts"]);
    const onChange = vi.fn(), added = vi.fn(), onError = vi.fn();
    const listener = database.addEventListener(["posts", {uid: "author"}], {onChange, onChildAdd: added, onError});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        await database.create(["posts", {post_id: "other"}], {uid: "other", title: "Other"});
        expect(added).not.toHaveBeenCalled();
        await database.create(["posts", {post_id: "own"}], {uid: "author", title: "Own"});
        expect(added).toHaveBeenCalledExactlyOnceWith({key: "own", value: {uid: "author", title: "Own"}});
        expect(onError).not.toHaveBeenCalled();
    } finally { listener.remove(); }
});
