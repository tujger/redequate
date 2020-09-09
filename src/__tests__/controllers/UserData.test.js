// jest.mock("@material-ui/styles/withStyles");

import {
    matchRole,
    Role,
    currentRole,
    logoutUser,
    needAuth,
    watchUserChanged,
    useCurrentUserData,
    UserData,
    normalizeSortName,
    currentUserData,
    sendVerificationEmail,
    sendInvitationEmail
} from "../../controllers/UserData";
import {firebase, store} from "../common";
import React from "react";

// jest.enableAutomock();
// jest.mock('notistack');

beforeAll(() => {
    console.log("SETUP")
});

let userDataUser;
beforeEach(() => {
    userDataUser = UserData(firebase).create("test_user_id", {
        email: "user@mail.com",
        emailVerified: true,
        name: "User name",
        image: "test/user/image"
    });
});

const userDataAdmin = UserData(firebase).create("test_admin_id", Role.ADMIN, {
    email: "admin@mail.com",
    emailVerified: true,
    name: "Admin name",
});
const userDataUserDisabled = UserData(firebase).create("test_user_disabled_id", Role.DISABLED, {
    email: "disabled@mail.com",
    name: "Disabled user name",
});
const userDataUserNotVerified = UserData(firebase).create("test_user_not_verified_id", {
    email: "notverified@mail.com",
    name: "Not verified user name",
});
const userDataServiceUser = UserData(firebase).create("test_user_service", {
    email: "tujger.dev@gmail.com",
    name: "Service user",
});


// matchRole(roles, user) {
const rolesAdminUser = [Role.USER, Role.ADMIN];

test("watchUserChanged", () => {
    expect(watchUserChanged(firebase, store)).rejects.toThrow(Error);
});
test("logoutUser", async () => {
    return logoutUser(firebase, store)()
        .then(e => expect(e).toEqual(null))
        .catch(e => expect(e).toMatch('error'));
});
test("useCurrentUserData", async () => {
    expect(useCurrentUserData()).toMatchObject({"id": undefined, "private": {}, "public": {}, "role": Role.LOGIN})
    expect(useCurrentUserData(userDataAdmin)).toEqual(userDataAdmin)
    expect(useCurrentUserData()).toEqual(userDataAdmin)
    expect(useCurrentUserData(userDataUser)).toEqual(userDataUser)
    expect(useCurrentUserData()).toEqual(userDataUser)
});
test("sendInvitationEmail", async () => {
    useCurrentUserData(userDataServiceUser);
    return sendInvitationEmail(firebase)({email: userDataServiceUser.email})
        .then(e => expect(e).toEqual(undefined))

});
test("sendVerificationEmail", async () => {
    useCurrentUserData(userDataServiceUser);
    return expect(sendVerificationEmail(firebase)).rejects.toThrow(TypeError);
});
test("currentUserData", async () => {
    expect(currentUserData({}, {type: "currentUserData", userData: userDataUser}))
        .toEqual({userData: userDataUser.toJSON()})
});

it("currentRole", () => {
    expect(currentRole(userDataAdmin)).toEqual(Role.ADMIN);
    expect(currentRole(userDataUser)).toEqual(Role.USER);
    expect(currentRole(userDataUserDisabled)).toEqual(Role.DISABLED);
    expect(currentRole(userDataUserNotVerified)).toEqual(Role.USER_NOT_VERIFIED);
    expect(currentRole(null)).toEqual(Role.LOGIN);
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
        console.log(userDataUser.created);
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
        expect(userDataAdmin.role).toEqual(Role.ADMIN);
        expect(userDataUser.role).toEqual(Role.USER);
        expect(userDataUserDisabled.role).toEqual(Role.DISABLED);
        expect(userDataUserNotVerified.role).toEqual(Role.USER_NOT_VERIFIED);
    });
    it("updated", () => {
        console.log(userDataAdmin.updated);
        console.log(userDataUser.updated);
        console.log(userDataUserDisabled.updated);
        console.log(userDataUserNotVerified.updated);
    });
    it("verified", () => {
        expect(userDataAdmin.verified).toBeTruthy();
        expect(userDataUser.verified).toBeTruthy();
        expect(userDataUserDisabled.verified).not.toBeTruthy();
        expect(userDataUserNotVerified.verified).not.toBeTruthy();
    });
    it("date", () => {
        console.log(userDataAdmin.date("M-D-YYYY HH:mm A"));
        console.log(userDataUser.date("M-D-YYYY HH:mm A"));
        console.log(userDataUserDisabled.date("M-D-YYYY HH:mm A"));
        console.log(userDataUserNotVerified.date("M-D-YYYY HH:mm A"));
    });
    it("toJSON", () => {
        console.log(userDataAdmin.toJSON());
        console.log(userDataUser.toJSON());
        console.log(userDataUserDisabled.toJSON());
        console.log(userDataUserNotVerified.toJSON());
    });
    it("toString", () => {
        expect(userDataAdmin.toString()).toMatch(/id:.*?test_admin_id.*?, name:.*?Admin name.*/);
        expect(userDataUser.toString()).toMatch(/id:.*?test_user_id.*?, name:.*?User name.*/);
        expect(userDataUserDisabled.toString()).toMatch(/id:.*?test_user_disabled_id.*?, name:.*?Disabled user name.*/);
        expect(userDataUserNotVerified.toString()).toMatch(/id:.*?test_user_not_verified_id.*?, name:.*?Not verified user name.*/);
    });
    it("delete", () => {
        return expect(userDataUser.delete()).rejects.toThrow(Error);
    });
    it("fetch", () => {
        return expect(userDataUser.fetch(userDataUser.id, [UserData.PUBLIC])).rejects.toThrow(Error);
    });
    it("fetchPrivate", () => {
        return expect(userDataUser.fetchPrivate("device_id", true)).rejects.toThrow(Error);
    });
    it("fromFirebaseAuth", () => {
        expect(userDataUser.fromFirebaseAuth({
            providerData: [{providerId: "test"}],
            uid: "test_from_firebase_auth_user_id"
        })).toMatchObject({id: "test_from_firebase_auth_user_id"});
    });
    it("fromJSON", () => {
        const userData = UserData(firebase);
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
    it("savePublic", () => {
        return expect(userDataUser.savePublic()).resolves.toEqual(userDataUser);
    });
    it("savePrivate", () => {
        return expect(userDataUser.savePrivate()).resolves.toEqual(userDataUser);
    });
    it("set", () => {
        // console.log(userDataUser.set(data));
    });
    it("setPrivate", () => {
        const privatePart = {
            "device_id": {os: "Test"}
        }
        return expect(userDataUser.setPrivate("device_id", privatePart.device_id)).resolves.toMatchObject(privatePart);
    });
    it("update", () => {
        expect(userDataUser.update("name", "New user name")).toBeUndefined()
    });
})


it("normalizeSortName", () => {
    expect(normalizeSortName(userDataAdmin.name)).toMatch(/^adminname$/);
    expect(normalizeSortName(userDataUser.name)).toMatch(/^username$/);
    expect(normalizeSortName(userDataUserDisabled.name)).toMatch(/^disabledusername$/);
    expect(normalizeSortName(userDataUserNotVerified.name)).toMatch(/^notverifiedusername$/);
});
