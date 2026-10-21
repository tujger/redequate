import {vi} from "vitest";
import {signInAnonymously} from "firebase/auth";
import notifySnackbar from "../../controllers/notifySnackbar";
import {UserRole} from "../../../packages/common/src/UserRole";
import {
    currentRole,
    logoutUser,
    matchRole,
    needAuth,
    normalizeSortName,
    UserData,
    watchUserChanged
} from "../../controllers/UserData";
import {auth, database, firebase, sdkAuth, seedDatabase} from "../common";

vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));

let userDataUser;
beforeEach(() => {
    userDataUser = new UserData(database).create("test_user_id", {
        email: "user@mail.com",
        emailVerified: true,
        name: "User name",
        image: "test/user/image"
    });
});

const userDataAdmin = new UserData(database).create("test_admin_id", UserRole.ADMIN, {
    email: "admin@mail.com",
    emailVerified: true,
    name: "Admin name",
});
const userDataUserDisabled = new UserData(database).create("test_user_disabled_id", UserRole.DISABLED, {
    email: "disabled@mail.com",
    name: "Disabled user name",
});
const userDataUserNotVerified = new UserData(database).create("test_user_not_verified_id", {
    email: "notverified@mail.com",
    name: "Not verified user name",
});

// matchRole(roles, user) {
const rolesAdminUser = [UserRole.USER, UserRole.ADMIN];

test("watchUserChanged", async () => {
    const authenticatedUser = await auth.createUserWithEmailAndPassword("watch@example.test", "test-password");
    const user = new UserData(database).create(authenticatedUser.id, {email: "watch@example.test", name: "Watcher", updated: 0});
    const getUserData = () => user;
    const onUserChanged = vi.fn();
    const updated = Date.now() + 1000;
    await seedDatabase({users_public: {[user.id]: {...user.public, updated}}});
    const timestamp = await firebase.database().ref(`users_public/${user.id}/updated`).once("value");
    expect(timestamp.val()).toBe(updated);
    const original = auth.onAuthStateChanged.bind(auth);
    let subscription;
    vi.spyOn(auth, "onAuthStateChanged").mockImplementation(callback => {
        subscription = original(callback);
        return subscription;
    });
    const read = vi.spyOn(database, "read");
    const refresh = watchUserChanged({auth, database, getUserData, onUserChanged});
    try {
        const path = ["users_public", {user_id: user.id}, {updated: "updated"}];
        await vi.waitFor(() => expect(read).toHaveBeenCalledWith(path));
        const index = read.mock.calls.findIndex(([requested]) => JSON.stringify(requested) === JSON.stringify(path));
        expect(await read.mock.results[index].value).toBe(updated);
        await vi.waitFor(() => expect(notifySnackbar).toHaveBeenCalled());
        const warning = notifySnackbar.mock.calls.at(-1)[0];
        expect(warning).toMatchObject({variant: "warning", buttonLabel: "Refresh"});
        warning.onButtonClick();
        await refresh;
        expect(onUserChanged).toHaveBeenCalledTimes(1);
        expect(onUserChanged).toHaveBeenCalledWith(expect.objectContaining({
            id: user.id, public: expect.objectContaining({updated}),
        }));
    } finally {
        const unsubscribe = await subscription;
        unsubscribe?.();
    }
});
test("logoutUser", async () => {
    await signInAnonymously(sdkAuth);
    const onLogout = vi.fn();
    await expect(logoutUser({auth, onLogout})).resolves.toBeNull();
    expect(sdkAuth.currentUser).toBeNull();
    expect(onLogout).toHaveBeenCalledExactlyOnceWith();
});

it("currentRole", () => {
    expect(currentRole(userDataAdmin)).toEqual(UserRole.ADMIN);
    expect(currentRole(userDataUser)).toEqual(UserRole.USER);
    expect(currentRole(userDataUserDisabled)).toEqual(UserRole.DISABLED);
    expect(currentRole(userDataUserNotVerified)).toEqual(UserRole.USER_NOT_VERIFIED);
    expect(currentRole(null)).toEqual(UserRole.LOGIN);
});
it("matchRole", () => {
    expect(matchRole(rolesAdminUser, userDataAdmin)).toBeTruthy();
    expect(matchRole(rolesAdminUser, userDataUser)).toBeTruthy();
    expect(matchRole(rolesAdminUser, userDataUserDisabled)).not.toBeTruthy();
    expect(matchRole(rolesAdminUser, userDataUserNotVerified)).not.toBeTruthy();
});
it("needAuth", () => {
    expect(needAuth(rolesAdminUser, userDataAdmin)).not.toBeTruthy();
    expect(needAuth(rolesAdminUser, userDataUser)).not.toBeTruthy();
    expect(needAuth(rolesAdminUser, userDataUserDisabled)).not.toBeTruthy();
    expect(needAuth(rolesAdminUser, userDataUserNotVerified)).not.toBeTruthy();
    expect(needAuth(rolesAdminUser, null)).toBeTruthy();
});

// UserData tests
describe("UserData", () => {
    it("asString", () => {
        expect(userDataAdmin.asString).toMatch(/id: test_admin_id, name: Admin name.*/);
        expect(userDataUser.asString).toMatch(/id: test_user_id, name: User name.*/);
        expect(userDataUserDisabled.asString).toMatch(/id: test_user_disabled_id, name: Disabled user name.*/);
        expect(userDataUserNotVerified.asString).toMatch(/id: test_user_not_verified_id, name: Not verified user name.*/);
    });
    it("created", () => {
        expect(userDataUser.public.created).toEqual(expect.any(Number));
        expect(userDataUser.public.created).toBeLessThanOrEqual(Date.now());
    });
    it("disabled", () => {
        expect(userDataAdmin.disabled).not.toBeTruthy();
        expect(userDataUser.disabled).not.toBeTruthy();
        expect(userDataUserDisabled.disabled).toBeTruthy();
        expect(userDataUserNotVerified.disabled).not.toBeTruthy();
    });
    it("email", () => {
        expect(userDataAdmin.email).toMatch(/admin@mail.com/);
        expect(userDataUser.email).toMatch(/user@mail.com/);
        expect(userDataUserDisabled.email).toMatch(/disabled@mail.com/);
        expect(userDataUserNotVerified.email).toMatch(/notverified@mail.com/);
    });
    it("persisted", () => {
        expect(userDataAdmin.persisted).not.toBeTruthy();
        expect(userDataUser.persisted).not.toBeTruthy();
        expect(userDataUserDisabled.persisted).not.toBeTruthy();
        expect(userDataUserNotVerified.persisted).not.toBeTruthy();
    });
    it("id", () => {
        expect(userDataAdmin.id).toMatch(/test_admin_id/);
        expect(userDataUser.id).toMatch(/test_user_id/);
        expect(userDataUserDisabled.id).toMatch(/test_user_disabled_id/);
        expect(userDataUserNotVerified.id).toMatch(/test_user_not_verified_id/);
    });
    it("image", () => {
        expect(userDataAdmin.image).toBeUndefined();
        expect(userDataUser.image).toMatch(/test\/user\/image/);
        expect(userDataUserDisabled.image).toBeUndefined();
        expect(userDataUserNotVerified.image).toBeUndefined();
    });
    it("initials", () => {
        expect(userDataAdmin.initials).toMatch(/^AN$/);
        expect(userDataUser.initials).toMatch(/^UN$/);
        expect(userDataUserDisabled.initials).toMatch(/^DU$/);
        expect(userDataUserNotVerified.initials).toMatch(/^NV$/);
    });
    it("name", () => {
        expect(userDataAdmin.name).toMatch(/^Admin name$/);
        expect(userDataUser.name).toMatch(/^User name$/);
        expect(userDataUserDisabled.name).toMatch(/^Disabled user name$/);
        expect(userDataUserNotVerified.name).toMatch(/^Not verified user name$/);
    });
    it("private", () => {
        expect(userDataAdmin.private).toMatchObject({});
        expect(userDataUser.private).toMatchObject({});
        expect(userDataUserDisabled.private).toMatchObject({});
        expect(userDataUserNotVerified.private).toMatchObject({});
    });
    it("public", () => {
        expect(userDataAdmin.public).toMatchObject({email: "admin@mail.com", name: "Admin name"});
        expect(userDataUser.public).toMatchObject({email: "user@mail.com", name: "User name"});
        expect(userDataUserDisabled.public).toMatchObject({email: "disabled@mail.com", name: "Disabled user name"});
        expect(userDataUserNotVerified.public).toMatchObject({email: "notverified@mail.com", name: "Not verified user name"});
    });
    it("role", () => {
        expect(userDataAdmin.role).toEqual(UserRole.ADMIN);
        expect(userDataUser.role).toEqual(UserRole.USER);
        expect(userDataUserDisabled.role).toEqual(UserRole.DISABLED);
        expect(userDataUserNotVerified.role).toEqual(UserRole.USER_NOT_VERIFIED);
    });
    it("updated", () => {
        expect(userDataUser.updated).toBe("");
    });
    it("verified", () => {
        expect(userDataAdmin.verified).toBeTruthy();
        expect(userDataUser.verified).toBeTruthy();
        expect(userDataUserDisabled.verified).not.toBeTruthy();
        expect(userDataUserNotVerified.verified).not.toBeTruthy();
    });
    it("date", () => {
        expect(userDataUser.date()).toBe(new Date(userDataUser.public.created).toLocaleString());
    });
    it("toJSON", () => {
        expect(userDataUser.toJSON()).toMatchObject({id: userDataUser.id, public: userDataUser.public, private: {}});
    });
    it("toString", () => {
        expect(userDataAdmin.toString()).toMatch(/id:.*?test_admin_id.*?, name:.*?Admin name.*/);
        expect(userDataUser.toString()).toMatch(/id:.*?test_user_id.*?, name:.*?User name.*/);
        expect(userDataUserDisabled.toString()).toMatch(/id:.*?test_user_disabled_id.*?, name:.*?Disabled user name.*/);
        expect(userDataUserNotVerified.toString()).toMatch(/id:.*?test_user_not_verified_id.*?, name:.*?Not verified user name.*/);
    });
    it("delete", async () => {
        await seedDatabase({users_public: {[userDataUser.id]: userDataUser.public}});
        await expect(userDataUser.delete()).resolves.toEqual(userDataUser);
        await signInAnonymously(sdkAuth);
        expect((await firebase.database().ref(`users_public/${userDataUser.id}`).once("value")).exists()).toBe(false);
    });
    it("fetch", async () => {
        userDataUser = new UserData(database).create(window.crypto.randomUUID(), {
            email: "fresh@example.test", name: "Fresh User"
        });
        await expect(userDataUser.fetch(userDataUser.id, [UserData.PUBLIC, UserData.FORCE])).rejects.toThrow();
        await signInAnonymously(sdkAuth);
        await seedDatabase({users_public: {[userDataUser.id]: {...userDataUser.public, name: "Fetched name"}}});
        await userDataUser.fetch(userDataUser.id, [UserData.PUBLIC, UserData.FORCE]);
        expect(userDataUser.name).toBe("Fetched name");
    });
    it("fetchPrivate", async () => {
        await expect(userDataUser.fetchPrivate("device_id", true)).rejects.toThrow();
        const {user} = await signInAnonymously(sdkAuth);
        const ownData = new UserData(database).create(user.uid, {email: "own@example.test", name: "Owner"});
        await seedDatabase({users_private: {[user.uid]: {device_id: {os: "Test"}}}});
        await expect(ownData.fetchPrivate("device_id", true)).resolves.toBe(ownData);
        expect(ownData.private.device_id).toEqual({os: "Test"});
    });
    it("fromJSON", () => {
        const userData = new UserData(database);
        expect(userData.fromJSON(userDataUser.toJSON())).toMatchObject({
            id: "test_user_id",
            public: {
                _sort_name: "username_test_user_id",
                email: "user@mail.com",
                emailVerified: true,
                image: "test/user/image",
                name: "User name"
            }
        });
    });
    it("save", () => {
        return expect(userDataUser.save()).resolves.toEqual(userDataUser);
    });
    it("savePublic", async () => {
        await expect(userDataUser.savePublic()).resolves.toEqual(userDataUser);
        await signInAnonymously(sdkAuth);
        const saved = (await firebase.database().ref(`users_public/${userDataUser.id}`).once("value")).val();
        expect(saved).toMatchObject({name: "User name", _sort_name: "username_test_user_id"});
        expect(saved.updated).toEqual(expect.any(Number));
    });
    it("savePrivate", () => {
        return expect(userDataUser.savePrivate()).resolves.toEqual(userDataUser);
    });
    it("set", async () => {
        await expect(userDataUser.set({name: "Changed"})).resolves.toBe(userDataUser);
        expect(userDataUser.name).toBe("Changed");
    });
    it("setPrivate", () => {
        const privatePart = {
            device_id: {os: "Test"}
        }
        return expect(userDataUser.setPrivate("device_id", privatePart.device_id)).resolves.toMatchObject(privatePart);
    });
    it("update", () => {
        expect(userDataUser.update("name", "New user name")).toBeUndefined();
        expect(userDataUser.name).toBe("User name");
        userDataUser.update({name: "New user name"});
        expect(userDataUser.name).toBe("New user name");
    });
})

it("normalizeSortName", () => {
    expect(normalizeSortName(userDataAdmin.name)).toMatch(/^adminname$/);
    expect(normalizeSortName(userDataUser.name)).toMatch(/^username$/);
    expect(normalizeSortName(userDataUserDisabled.name)).toMatch(/^disabledusername$/);
    expect(normalizeSortName(userDataUserNotVerified.name)).toMatch(/^notverifiedusername$/);
});
