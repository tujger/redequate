import {IDBObjectStore} from "fake-indexeddb";
import {vi} from "vitest";
import {UserData} from "../../../../common";
import LocalAuth from "../../local";
import {createDatabase} from "../fixtures/database";
import {changeEvent, channelName, read, write} from "../../local/common";
import {installIndexedDB, flushIndexedDB, rawRecord} from "../fixtures/indexedDB";

// Attach rejection handling before advancing timers, including failing operations.
async function run(promise) {
    const pending = promise.then(value => ({value}), error => ({error}));
    await vi.runAllTimersAsync();
    await flushIndexedDB();
    const result = await pending;
    await flushIndexedDB();
    if (result.error) throw result.error;
    return result.value;
}

let database;
let auth;
const createAuth = (options = {}) => new LocalAuth({database, ...options});
let unsubscribes;
beforeEach(() => {
    installIndexedDB();
    window.localStorage.clear();
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "Date"]});
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "debug").mockImplementation(() => {});
    database = createDatabase();
    auth = createAuth();
    unsubscribes = [];
});
afterEach(() => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
});
const register = () => run(auth.createUserWithEmailAndPassword("user@example.test", "password"));
const stored = () => read(auth);

it("assigns ADMIN only to the first user of an empty local database", async () => {
    const first = await register();
    expect(first.role).toBe("admin");
    expect(await database.read(["roles", {user_id: first.id}])).toBe("admin");
    await database.update(new Map([[ ["roles", {user_id: first.id}], null ]]));
    const second = await run(auth.createUserWithEmailAndPassword("second@example.test", "password"));
    expect(second.role).not.toBe("admin");
    expect(await database.read(["roles", {user_id: second.id}])).toBeUndefined();
    const third = await run(auth.createUserWithEmailAndPassword("third@example.test", "password"));
    expect(third.role).not.toBe("admin");
});

it("does not bootstrap an administrator when the database already contains users", async () => {
    await database.update(new Map([[ ["users_public", {user_id: "existing"}], {name: "Existing"} ]]));
    const user = await register();
    expect(user.role).not.toBe("admin");
    expect(await database.read(["roles", {user_id: user.id}])).toBeUndefined();
});

it("bootstraps the first simulated provider account through the same registration path", async () => {
    const first = await run(auth.signInWithPopup("google"));
    expect(first.role).toBe("admin");
    expect(await database.read(["roles", {user_id: first.id}])).toBe("admin");
    const second = await register();
    expect(second.role).not.toBe("admin");
});

it("rolls back registration when the initial profile write fails", async () => {
    const failure = new Error("profile write failed");
    database.update.mockRejectedValueOnce(failure);
    await expect(register()).rejects.toBe(failure);
    expect((await stored()).accounts).toHaveLength(0);
    expect(await database.read(["roles"])).toBeUndefined();
});

it("constructs without accessing storage and validates its namespace", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    expect(createAuth()).toBeInstanceOf(LocalAuth);
    expect(auth).not.toHaveProperty("from");
    expect(auth).not.toHaveProperty("resolveToken");
    expect(getItem).not.toHaveBeenCalled();
    expect(() => createAuth({storageKey: ""})).toThrow();
});
it("uses the constructor model for sign-in, restoration and subscriptions", async () => {
    class CustomUserData extends UserData {}
    auth = createAuth({UserData: CustomUserData});
    const callback = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(callback)));
    expect(callback.mock.calls.at(-1)[0]).toBeInstanceOf(CustomUserData);
    expect((await run(auth.resolveCurrentUser())).id).toBeUndefined();
    expect(await register()).toBeInstanceOf(CustomUserData);
    expect(callback.mock.calls.at(-1)[0]).toBeInstanceOf(CustomUserData);
    expect(await run(auth.resolveCurrentUser())).toBeInstanceOf(CustomUserData);
    await run(auth.signOut());
    expect(callback.mock.calls.at(-1)[0]).toBeInstanceOf(CustomUserData);
    expect(callback.mock.calls.at(-1)[0].id).toBeUndefined();
    expect(await run(auth.signInWithEmailAndPassword("user@example.test", "password"))).toBeInstanceOf(CustomUserData);
    expect(await run(auth.signInWithPopup("google.com"))).toBeInstanceOf(CustomUserData);
    expect(await run(auth.signInWithCredential("token"))).toBeInstanceOf(CustomUserData);
    await run(auth.sendSignInLinkToEmail("user@example.test"));
    expect(await run(auth.signInWithEmailLink("user@example.test"))).toBeInstanceOf(CustomUserData);
    await run(auth.signInWithRedirect("facebook.com"));
    expect(await run(auth.resolveRedirectResult())).toBeInstanceOf(CustomUserData);
});
it("registers, normalizes email and restores detached user snapshots", async () => {
    const user = await run(auth.createUserWithEmailAndPassword(" User@Example.test ", "password"));
    expect(user).toMatchObject({email: "user@example.test", verified: false});
    expect(user.toJSON()).not.toHaveProperty("password");
    expect(user.toJSON()).not.toHaveProperty("token");
    expect(await run(createAuth().resolveCurrentUser())).toMatchObject({id: user.id, _userData: true});
    const parsed = await run(auth.resolveCurrentUser());
    expect(parsed).toMatchObject({id: user.id, _userData: true, public: {email: user.email, provider: "password"}});
    expect(parsed.toJSON().loaded).toMatchObject({public: true});
    expect(parsed.toJSON().requested).toEqual(expect.any(Number));
    user.public.name = "Unsaved";
    expect((await run(auth.resolveCurrentUser())).public.name).toBeNull();
});
it("loads database data for the local user and skips reads after sign-out", async () => {
    const read = vi.fn(path => Promise.resolve({
        users_public: {name: "Stored name"}, roles: "admin", users_private: {device: {locale: "en"}}
    }[path[0]]));
    auth = createAuth({database: {read, update: vi.fn().mockResolvedValue()}});
    const user = await register();
    expect(user).toMatchObject({name: "Stored name", role: "admin", private: {device: {locale: "en"}}});
    expect(read.mock.calls.map(([path]) => path)).toEqual([
        ["users_public"],
        ["users_public", {user_id: user.id}], ["roles", {user_id: user.id}], ["users_private", {user_id: user.id}]
    ]);
    await run(auth.signOut());
    await run(auth.resolveCurrentUser());
    expect(read).toHaveBeenCalledTimes(4);
    const failure = new Error("database unavailable");
    read.mockRejectedValue(failure);
    await expect(run(auth.signInWithEmailAndPassword(user.email, "password"))).rejects.toBe(failure);
});
it("does not create a registration or notify observers when its database load fails", async () => {
    const failure = new Error("database unavailable");
    auth = createAuth({database: {read: vi.fn().mockRejectedValue(failure), update: vi.fn().mockResolvedValue()}});
    const callback = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(callback)));
    const event = vi.fn();
    window.addEventListener(changeEvent, event);
    try {
        await expect(register()).rejects.toBe(failure);
        expect((await stored()).revision).toBeNull();
        expect(callback).toHaveBeenCalledTimes(1);
        expect(event).not.toHaveBeenCalled();
    } finally {
        window.removeEventListener(changeEvent, event);
    }
});
it.each([
    ["password", () => auth.signInWithEmailAndPassword("user@example.test", "password")],
    ["email link", () => auth.signInWithEmailLink("link@example.test")],
    ["popup", () => auth.signInWithPopup("google.com")],
    ["credential", () => auth.signInWithCredential("fake-token")],
    ["redirect", () => auth.signInWithRedirect("facebook.com")]
])("preserves the previous session and account on failed %s database load", async (name, signIn) => {
    await register();
    await run(auth.sendSignInLinkToEmail("link@example.test"));
    const before = await stored();
    const failure = new Error("database unavailable");
    auth = createAuth({database: {read: vi.fn().mockRejectedValue(failure), update: vi.fn().mockResolvedValue()}});
    const callback = vi.fn();
    unsubscribes.push(await run(createAuth().onAuthStateChanged(callback)));
    const event = vi.fn();
    window.addEventListener(changeEvent, event);
    try {
        await expect(run(signIn())).rejects.toBe(failure);
        expect(await stored()).toEqual(before);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(event).not.toHaveBeenCalled();
    } finally {
        window.removeEventListener(changeEvent, event);
    }
});
it("loads the installed session through resolveCurrentUser before notifying observers", async () => {
    const user = await register();
    await run(auth.signOut());
    const event = vi.fn();
    const read = vi.fn(async () => {
        expect((await stored()).session.key).toBe(user.id);
        expect(event).not.toHaveBeenCalled();
        return Promise.resolve({name: "Stored name"});
    });
    auth = createAuth({database: {read, update: vi.fn().mockResolvedValue()}});
    const resolveCurrentUser = vi.spyOn(auth, "resolveCurrentUser");
    window.addEventListener(changeEvent, event);
    try {
        const signedIn = await run(auth.signInWithEmailAndPassword(user.email, "password"));
        expect(signedIn).toMatchObject({id: user.id, name: "Stored name"});
        expect(resolveCurrentUser).toHaveBeenCalledExactlyOnceWith({skipDelay: true});
        expect(await resolveCurrentUser.mock.results[0].value).toBe(signedIn);
        expect((await stored()).session.key).toBe(user.id);
        expect(event).toHaveBeenCalledTimes(1);
        expect(read).toHaveBeenCalledTimes(3);
    } finally {
        window.removeEventListener(changeEvent, event);
    }
});
it("does not restore a stale session after sign-out during a pending database load", async () => {
    await register();
    let finishLoad;
    const load = new Promise(resolve => { finishLoad = resolve; });
    const read = vi.fn(() => load);
    auth = createAuth({database: {read, update: vi.fn().mockResolvedValue()}});
    const signedIn = expect(auth.signInWithEmailAndPassword("user@example.test", "password"))
        .rejects.toMatchObject({code: "auth/state-changed"});
    await vi.runAllTimersAsync();
    await flushIndexedDB();
    expect(read).toHaveBeenCalledTimes(3);
    await run(auth.signOut());
    const afterSignOut = await stored();
    finishLoad(undefined);
    await signedIn;
    expect(await stored()).toEqual(afterSignOut);
    expect((await stored()).session).toBeNull();
});
it("keeps a redirect result available when its database load fails", async () => {
    await run(auth.signInWithRedirect("facebook.com"));
    const before = await stored();
    const failure = new Error("database unavailable");
    auth = createAuth({database: {read: vi.fn().mockRejectedValue(failure), update: vi.fn().mockResolvedValue()}});
    const event = vi.fn();
    window.addEventListener(changeEvent, event);
    try {
        await expect(run(auth.resolveRedirectResult())).rejects.toBe(failure);
        expect(await stored()).toEqual(before);
        expect(event).not.toHaveBeenCalled();
    } finally {
        window.removeEventListener(changeEvent, event);
    }
});
it("reports database observer failures without publishing an unloaded user", async () => {
    const user = await register();
    const failure = new Error("read failed");
    const read = vi.fn().mockRejectedValue(failure);
    const observer = createAuth({database: {read, update: vi.fn().mockResolvedValue()}});
    const callback = vi.fn();
    const onError = vi.fn();
    unsubscribes.push(await run(observer.onAuthStateChanged(callback, onError)));
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(callback).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledWith(["users_public", {user_id: user.id}]);
});
it.each([
    ["invalid", "password", "invalid-email"],
    ["user@example.test", "short", "weak-password"]
])("rejects invalid registration: %s", async (email, password, code) => {
    await expect(run(auth.createUserWithEmailAndPassword(email, password))).rejects.toMatchObject({code: `auth/${code}`});
    expect((await stored()).revision).toBeNull();
});
it("rejects duplicates and invalid credentials without changing the session", async () => {
    const user = await register();
    await expect(register()).rejects.toMatchObject({code: "auth/email-already-in-use"});
    await expect(run(auth.signInWithEmailAndPassword(user.email, "wrong"))).rejects.toMatchObject({code: "auth/invalid-credential"});
    await expect(run(auth.signInWithEmailAndPassword("missing@example.test", "password"))).rejects.toMatchObject({code: "auth/invalid-credential"});
    expect((await run(auth.resolveCurrentUser())).id).toBe(user.id);
});
it("signs out while preserving accounts and permits subsequent password login", async () => {
    const user = await register();
    await run(auth.signOut());
    expect(await run(auth.resolveCurrentUser())).toMatchObject({_userData: true, id: undefined});
    expect((await stored()).accounts).toHaveLength(1);
    expect((await run(auth.signInWithEmailAndPassword(user.email, "password"))).id).toBe(user.id);
});
it("isolates keys while sharing sessions between matching namespaces", async () => {
    const user = await register();
    expect((await run(createAuth().resolveCurrentUser())).id).toBe(user.id);
    const separate = createAuth({storageKey: "separate"});
    expect(await run(separate.resolveCurrentUser())).toMatchObject({_userData: true, id: undefined});
    await run(separate.signOut());
    expect((await run(auth.resolveCurrentUser())).id).toBe(user.id);
});
it("updates profile and password through Auth", async () => {
    const user = await register();
    await run(auth.updateProfile({public: {name: "Tester", image: "https://example.test/photo"}}));
    await run(auth.updatePassword("changed-password"));
    await run(auth.updatePassword("final-password"));
    await run(auth.signOut());
    await expect(run(auth.signInWithEmailAndPassword(user.email, "password"))).rejects.toMatchObject({code: "auth/invalid-credential"});
    const restored = (await run(auth.signInWithEmailAndPassword(user.email, "final-password")));
    expect(restored).toMatchObject({name: "Tester", image: "https://example.test/photo"});
    await run(auth.updateProfile({public: {name: null, image: null}}));
    expect(await database.read(["users_public", {user_id: user.id}, {name: "name"}])).toBeUndefined();
    expect(await run(auth.resolveCurrentUser())).toMatchObject({public: {name: null, image: null}});
});
it("keeps user data free of Auth operations and rejects invalid profile fields", async () => {
    const user = await register();
    expect(user).not.toHaveProperty("updatePassword");
    expect(user).not.toHaveProperty("uid");
    expect(user).not.toHaveProperty("providerData");
    expect(user).not.toHaveProperty("user");
    await run(auth.signInWithPopup("google"));
    await expect(run(auth.updateProfile({public: "invalid"}))).rejects.toMatchObject({code: "auth/invalid-argument"});
    expect((await run(auth.resolveCurrentUser())).name).toBe("Local Test Google");
    await run(auth.signOut());
    await expect(run(auth.updatePassword("password"))).rejects.toMatchObject({code: "auth/no-current-user"});
    await expect(run(auth.sendEmailVerification())).rejects.toMatchObject({code: "auth/no-current-user"});
});
it("uses stable fake providers and rejects collisions and unsupported credentials", async () => {
    const google = (await run(auth.signInWithPopup("google.com")));
    expect(google).toMatchObject({email: "google@local.example", verified: true});
    expect((await run(auth.signInWithCredential("fake-token"))).id).toBe(google.id);
    expect((await run(auth.signInWithCredential({provider: "facebook", accessToken: "fake"}))).email).toBe("facebook@local.example");
    expect((await run(auth.signInWithPopup({providerId: "google.com"}))).id).toBe(google.id);
    await expect(run(auth.signInWithCredential(""))).rejects.toMatchObject({code: "auth/invalid-credential"});
    await expect(run(auth.signInWithPopup("unknown"))).rejects.toMatchObject({code: "auth/operation-not-supported"});
    const separate = createAuth({storageKey: "collision"});
    await run(separate.createUserWithEmailAndPassword("google@local.example", "password"));
    await expect(run(separate.signInWithPopup("google"))).rejects.toMatchObject({code: "auth/account-exists-with-different-credential"});
});
it("persists and consumes redirect results once", async () => {
    await run(auth.signInWithRedirect("facebook.com"));
    const reloaded = createAuth();
    expect((await run(reloaded.resolveRedirectResult())).email).toBe("facebook@local.example");
    expect(await run(auth.resolveRedirectResult())).toBeNull();
});
it("simulates email verification, records reset requests and consumes email sign-in requests", async () => {
    const user = await register();
    await run(auth.sendEmailVerification());
    expect((await run(auth.resolveCurrentUser())).verified).toBe(true);
    await run(auth.sendPasswordResetEmail(user.email, {url: "https://example.test/reset"}));
    expect((await stored()).accounts[0].password).toBe("password");
    await expect(run(auth.sendPasswordResetEmail("missing@example.test"))).rejects.toMatchObject({code: "auth/user-not-found"});
    await run(auth.sendSignInLinkToEmail(" LINK@Example.test "));
    expect(await run(auth.checkSignInWithEmailLink())).toBe(true);
    await expect(run(auth.signInWithEmailLink("missing@example.test"))).rejects.toMatchObject({code: "auth/invalid-action-code"});
    const link = (await run(auth.signInWithEmailLink("link@example.test")));
    expect(link.verified).toBe(true);
    expect(await run(auth.checkSignInWithEmailLink())).toBe(false);
    await run(auth.updatePassword("password"));
    await run(auth.sendSignInLinkToEmail(link.email));
    expect((await run(auth.signInWithEmailLink(link.email))).id).toBe(link.id);
    expect((await stored()).mail).toEqual(expect.arrayContaining([
        expect.objectContaining({type: "verification", email: user.email}),
        expect.objectContaining({type: "password-reset", url: "https://example.test/reset"}),
        expect.objectContaining({type: "sign-in", email: link.email})
    ]));
});
it("records explicit email settings and uses shared defaults for sign-in links", async () => {
    const user = await register();
    const options = Object.freeze({url: "https://example.test/continue", handleCodeInApp: false});
    await run(auth.sendEmailVerification(options));
    await run(auth.sendPasswordResetEmail(user.email, options));
    await run(auth.sendSignInLinkToEmail(user.email, options));
    const state = await stored();
    for (const type of ["verification", "password-reset", "sign-in"]) {
        expect(state.mail.find(record => record.type === type)).toMatchObject(options);
    }
    await run(auth.sendSignInLinkToEmail("default@example.test", {url: undefined, handleCodeInApp: undefined}));
    expect((await stored()).mail.find(record => record.email === "default@example.test")).toMatchObject({
        url: window.location.origin + "/signup/default@example.test", handleCodeInApp: true
    });
});

it("publishes profile changes only after successful persistence", async () => {
    await register();
    const callback = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(callback)));
    callback.mockClear();
    const failure = new Error("profile unavailable");
    database.update.mockRejectedValueOnce(failure);
    await expect(run(auth.updateProfile({public: {name: "Unsaved"}}))).rejects.toBe(failure);
    expect(callback).not.toHaveBeenCalled();
    await run(auth.updateProfile({public: {name: "Saved"}}));
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({public: expect.objectContaining({name: "Saved"})}));
});

it("notifies peers on user changes but not on reset requests", async () => {
    const callback = vi.fn();
    unsubscribes.push(await run(createAuth().onAuthStateChanged(callback)));
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({_userData: true, id: undefined}));
    await register();
    expect(callback).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    await run(auth.sendPasswordResetEmail("user@example.test"));
    expect(callback).toHaveBeenCalledTimes(2);
    await run(auth.updateProfile({public: {name: "Changed"}}));
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({name: "Changed", _userData: true}));
    await run(auth.signOut());
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({_userData: true, id: undefined}));
    unsubscribes[0]();
    const calls = callback.mock.calls.length;
    await register().catch(() => run(auth.signInWithEmailAndPassword("user@example.test", "password")));
    expect(callback).toHaveBeenCalledTimes(calls);
});
it("observes BroadcastChannel changes and closing a subscription", async () => {
    const user = await register();
    const callback = vi.fn();
    const unsubscribe = await run(auth.onAuthStateChanged(callback));
    unsubscribes.push(unsubscribe);
    await database.update(new Map([[["users_public", {user_id: user.id}, "name"], "Other tab"]]));
    const channel = new BroadcastChannel(channelName);
    channel.postMessage({namespace: "other", revision: "ignored"});
    await flushIndexedDB();
    expect(callback).toHaveBeenCalledTimes(1);
    channel.postMessage({namespace: auth.storageKey, revision: "changed"});
    await flushIndexedDB();
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({name: "Other tab"}));
    unsubscribe();
    const calls = callback.mock.calls.length;
    channel.postMessage({namespace: auth.storageKey, revision: "later"});
    await flushIndexedDB();
    expect(callback).toHaveBeenCalledTimes(calls);
    channel.close();
});
it("preserves corrupt records and reports subscription errors", async () => {
    const user = await register();
    const state = await stored();
    const onError = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(vi.fn(), onError)));
    await rawRecord("auth_accounts", {...state.accounts[0], key: user.id, email: 42});
    window.dispatchEvent(new CustomEvent(changeEvent, {detail: auth.storageKey}));
    await flushIndexedDB();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "auth/invalid-storage"}));
    await expect(run(auth.resolveCurrentUser())).rejects.toMatchObject({code: "auth/invalid-storage"});
    await expect(run(auth.onAuthStateChanged(vi.fn()))).rejects.toMatchObject({code: "auth/invalid-storage"});
});
it("rejects failed transactions without publishing successful changes", async () => {
    await register();
    const callback = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(callback)));
    const before = await stored();
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new Error("quota"); });
    await expect(run(auth.signOut())).rejects.toMatchObject({code: "auth/storage-unavailable"});
    expect(callback).toHaveBeenCalledTimes(1);
    expect(await stored()).toEqual(before);
    put.mockRestore();
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new Error("disabled"); });
    await expect(run(auth.resolveCurrentUser())).rejects.toMatchObject({code: "auth/storage-unavailable"});
});
it.each([0, 100, 101, 2000])("waits %i ms and logs only delays greater than 100 ms", async milliseconds => {
    Math.random.mockReturnValue((milliseconds + 0.1) / 2001);
    const before = Date.now();
    await run(auth.resolveCurrentUser());
    expect(Date.now() - before).toBe(milliseconds);
    expect(console.debug).toHaveBeenCalledTimes(milliseconds > 100 ? 1 : 0);
    if (milliseconds > 100) expect(console.debug).toHaveBeenCalledWith(`[LocalAuth] resolveCurrentUser: ${milliseconds} ms`);
});
it("delays password updates once without exposing an Auth parser", async () => {
    await register();
    Math.random.mockReturnValue(101.1 / 2001);
    console.debug.mockClear();
    const before = Date.now();
    await run(auth.updatePassword("new-password"));
    expect(Date.now() - before).toBe(101);
    expect(console.debug).toHaveBeenCalledTimes(1);
    expect(auth).not.toHaveProperty("from");
    expect(Date.now() - before).toBe(101);
});

it("passes synchronous and asynchronous observer failures through unchanged", async () => {
    const onError = vi.fn();
    const syncError = new Error("sync failure");
    const asyncError = Object.assign(new Error("async failure"), {code: "observer/failure"});
    unsubscribes.push(await run(auth.onAuthStateChanged(() => { throw syncError; }, onError)));
    expect(onError).toHaveBeenLastCalledWith(syncError);
    unsubscribes.push(await run(auth.onAuthStateChanged(async () => { throw asyncError; }, onError)));
    expect(onError).toHaveBeenLastCalledWith(asyncError);
});

it("logs observer errors without an error callback and contains error callback failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const observerError = new Error("observer");
    unsubscribes.push(await run(auth.onAuthStateChanged(async () => { throw observerError; })));
    expect(log).toHaveBeenCalledWith("[LocalAuth] Auth state observer failed", observerError);
    const errorCallbackFailure = new Error("error callback");
    unsubscribes.push(await run(auth.onAuthStateChanged(() => { throw observerError; }, () => { throw errorCallbackFailure; })));
    expect(log).toHaveBeenCalledWith("[LocalAuth] Auth error callback failed", errorCallbackFailure);
});

it("keeps a newer login when an earlier pending login fails", async () => {
    const user = await register();
    let rejectLoad;
    const load = new Promise((resolve, reject) => { rejectLoad = reject; });
    const read = vi.fn(() => load);
    const pendingAuth = createAuth({database: {read}});
    const failure = new Error("old login load failed");
    const pending = expect(pendingAuth.signInWithEmailAndPassword(user.email, "password")).rejects.toBe(failure);
    await vi.runAllTimersAsync();
    await flushIndexedDB();
    expect(read).toHaveBeenCalledTimes(3);
    await run(auth.signInWithPopup("google.com"));
    const newerState = await stored();
    rejectLoad(failure);
    await pending;
    expect(await stored()).toEqual(newerState);
});
it("adds no second delay when login resolves its installed session", async () => {
    Math.random.mockReturnValue(101.1 / 2001);
    console.debug.mockClear();
    const before = Date.now();
    await register();
    expect(Date.now() - before).toBe(101);
    expect(console.debug).toHaveBeenCalledExactlyOnceWith("[LocalAuth] createUserWithEmailAndPassword: 101 ms");
});

it("invalidates a pending profile after a corrupt storage event", async () => {
    await register();
    let finish;
    const load = new Promise(resolve => { finish = resolve; });
    const observer = createAuth({database: {read: vi.fn(() => load)}});
    const callback = vi.fn();
    const onError = vi.fn();
    unsubscribes.push(await run(observer.onAuthStateChanged(callback, onError)));
    const state = await stored();
    await rawRecord("auth_accounts", {...state.accounts[0], email: 42});
    window.dispatchEvent(new CustomEvent(changeEvent, {detail: auth.storageKey}));
    await flushIndexedDB();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "auth/invalid-storage"}));
    finish(undefined);
    await run(Promise.resolve());
    expect(callback).not.toHaveBeenCalled();
});
