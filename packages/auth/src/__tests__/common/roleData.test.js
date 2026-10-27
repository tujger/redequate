import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import {UserData} from "../../../../common";
import FirebaseDatabase from "../../../../database/src/firebase";
import createLocalDatabase, {readNativeStore} from "../../../../database/src/__tests__/createLocalDatabase";
import AuthBase from "../../AuthBase";
import loadUserData from "../../common/loadUserData";
import saveUserData from "../../common/saveUserData";
import {roleQuery} from "../../common/roleData";
import {createDatabase} from "../fixtures/database";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("stores native Local roles, loads strings and filters through the role index", async () => {
    const database = createLocalDatabase({storageId: "native-roles"});
    await saveUserData({id: "one"}, {role: "admin"}, database);
    await saveUserData({id: "two"}, {role: "disabled"}, database);
    expect(await readNativeStore("native-roles", "roles")).toEqual([
        {_id: 1, user_id: "one", role: "admin"},
        {_id: 2, user_id: "two", role: "disabled"}
    ]);
    const user = new UserData().create("one");
    await loadUserData(user, database);
    expect(user.role).toBe("admin");
    expect(Object.keys(await database.read(["roles"], roleQuery(database, "admin")))).toEqual(["one"]);
    const cursor = database.cursor(["roles", "user_id"], roleQuery(database, "disabled"));
    expect((await cursor.next(10)).map(item => item.key)).toEqual(["two"]);
    await saveUserData({id: "two"}, {role: null}, database);
    expect(await database.read(["roles", {user_id: "two"}])).toBeUndefined();
});

it("preserves Firebase scalar writes, reads and queries", async () => {
    const database = new FirebaseDatabase({});
    const fixture = createDatabase();
    vi.spyOn(database, "update").mockImplementation(fixture.update);
    vi.spyOn(database, "read").mockImplementation(fixture.read);
    await saveUserData({id: "one"}, {role: "admin"}, database);
    expect([...database.update.mock.calls[0][0]]).toEqual([[["roles", {user_id: "one"}], "admin"]]);
    const user = new UserData().create("one");
    await loadUserData(user, database);
    expect(user.role).toBe("admin");
    expect(roleQuery(database, "admin")).toEqual({equalTo: "admin"});
    await saveUserData({id: "one"}, {role: null}, database);
    expect(await database.read(["roles", {user_id: "one"}])).toBeUndefined();
});

it("protects the last Local admin when AuthBase changes a profile", async () => {
    const database = createLocalDatabase({storageId: "auth-local-admin"});
    const auth = new AuthBase({database});
    await saveUserData({id: "one"}, {public: {name: "One"}, role: "admin"}, database);
    await saveUserData({id: "orphan"}, {role: "admin"}, database);
    await expect(auth._saveProfile({id: "one"}, {public: {name: "Changed"}, role: null}))
        .rejects.toMatchObject({code: "auth/last-admin"});
    expect(await database.read(["users_public", {user_id: "one"}])).toMatchObject({name: "One"});
    await saveUserData({id: "two"}, {public: {name: "Two"}, role: "admin"}, database);
    await auth._saveProfile({id: "one"}, {role: "disabled"});
    expect(await database.read(["roles", {user_id: "one"}])).toMatchObject({role: "disabled"});
});
