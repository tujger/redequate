import BackendBase from "../common/BackendBase";
import RoleListener from "../common/handlers/roles";
import FirebaseBackendServer from "../firebase-server/src/FirebaseBackendServer";
import LocalBackend from "../local/LocalBackend";
import {UserRole} from "../../../common";

const params = {user_id: "target"};
const cases = [
    ["onCreate", {value: UserRole.ADMIN}, UserRole.ADMIN, "user.role.create", {role: UserRole.ADMIN}],
    ["onCreate", {value: UserRole.USER}, UserRole.USER, "user.role.create", {role: UserRole.USER}],
    ["onUpdate", {previous: UserRole.USER, value: UserRole.ADMIN}, UserRole.ADMIN, "user.role.change",
        {previousRole: UserRole.USER, role: UserRole.ADMIN}],
    ["onUpdate", {previous: UserRole.ADMIN, value: UserRole.USER}, UserRole.USER, "user.role.change",
        {previousRole: UserRole.ADMIN, role: UserRole.USER}],
    ["onDelete", {value: UserRole.ADMIN}, null, "user.role.delete", {role: UserRole.ADMIN}],
];
const setup = () => {
    const backend = {
        changeRole: vi.fn().mockResolvedValue(undefined),
        getCurrentUser: vi.fn().mockResolvedValue("actor"),
        TIMESTAMP: 123,
        request: vi.fn().mockResolvedValue("activity"),
    };
    return {backend, listener: new RoleListener(backend)};
};

it.each(cases)("%s synchronizes role %j before recording activity", async (method, event, role, type, details) => {
    const {backend, listener} = setup();
    let release;
    backend.changeRole.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const pending = listener[method]({params, ...event});
    expect(backend.changeRole).toHaveBeenCalledExactlyOnceWith("target", role);
    expect(backend.getCurrentUser).not.toHaveBeenCalled();
    expect(backend.request).not.toHaveBeenCalled();
    release();
    await pending;
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["activity", "activity_id"], {
        uid: "actor", type, details: {uid: "target", ...details}, timestamp: 123,
    });
});

it("does nothing when an update retains the same role", async () => {
    const {backend, listener} = setup();
    await listener.onUpdate({params, previous: UserRole.ADMIN, value: UserRole.ADMIN});
    expect(backend.changeRole).not.toHaveBeenCalled();
    expect(backend.request).not.toHaveBeenCalled();
    expect(backend.getCurrentUser).not.toHaveBeenCalled();
});

it.each(cases)("%s propagates a role synchronization failure for %j without recording activity", async (method, event) => {
    const {backend, listener} = setup();
    const failure = new Error("Auth failed");
    backend.changeRole.mockRejectedValue(failure);
    await expect(listener[method]({params, ...event})).rejects.toBe(failure);
    expect(backend.getCurrentUser).not.toHaveBeenCalled();
    expect(backend.request).not.toHaveBeenCalled();
});

it.each(cases)("%s retains Local behavior with an empty changeRole for %j", async (method, event, role, type, details) => {
    const backend = new LocalBackend({storageId: "role-listener"});
    const changeRole = vi.spyOn(backend, "changeRole");
    vi.spyOn(backend, "getCurrentUser").mockResolvedValue("actor");
    const request = vi.spyOn(backend, "request").mockResolvedValue("activity");
    await new RoleListener(backend)[method]({params, ...event});
    expect(changeRole).toHaveBeenCalledExactlyOnceWith("target", role);
    expect(request).toHaveBeenCalledExactlyOnceWith("database.create", ["activity", "activity_id"], {
        uid: "actor", type, details: {uid: "target", ...details}, timestamp: backend.TIMESTAMP,
    });
});

it.each([
    [UserRole.ADMIN, {admin: true}], [UserRole.USER, null], [UserRole.AUTHOR, null],
    [UserRole.DISABLED, null], [null, null],
])("Firebase changeRole maps %j to exact claims %j using the database app", async (role, claims) => {
    const app = {};
    const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
    const getAuthInstance = vi.fn(() => ({setCustomUserClaims}));
    const backend = new FirebaseBackendServer(() => ({app}), undefined, {getAuthInstance});
    expect(getAuthInstance).not.toHaveBeenCalled();
    await backend.changeRole("target", role);
    expect(getAuthInstance).toHaveBeenCalledExactlyOnceWith(app);
    expect(setCustomUserClaims).toHaveBeenCalledExactlyOnceWith("target", claims);
});

it("Firebase changeRole awaits Auth and preserves its original error", async () => {
    let reject;
    const setCustomUserClaims = vi.fn(() => new Promise((resolve, fail) => { reject = fail; }));
    const backend = new FirebaseBackendServer(() => ({app: {}}), undefined, {
        getAuthInstance: () => ({setCustomUserClaims}),
    });
    const pending = backend.changeRole("target", UserRole.ADMIN);
    const failure = new Error("Auth unavailable");
    const check = expect(pending).rejects.toBe(failure);
    reject(failure);
    await check;
});


it("BackendBase requires a changeRole implementation", async () => {
    await expect(new BackendBase().changeRole("target", UserRole.ADMIN)).rejects.toThrow("Not implemented: changeRole");
});

it("Local changeRole resolves without requests, identity lookups or database access", async () => {
    const backend = new LocalBackend({storageId: "role-noop"});
    const request = vi.spyOn(backend, "request");
    const getCurrentUser = vi.spyOn(backend, "getCurrentUser");
    const open = vi.spyOn(indexedDB, "open");
    await expect(backend.changeRole("target", UserRole.ADMIN)).resolves.toBeUndefined();
    await expect(backend.changeRole("target", null)).resolves.toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
});
