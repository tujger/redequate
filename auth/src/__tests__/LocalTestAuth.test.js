import {vi} from "vitest";
import LocalTestAuth from "../local-test";

// Attach rejection handling before advancing timers, including failing operations.
async function run(promise) {
    const pending = promise.then(value => ({value}), error => ({error}));
    await vi.runAllTimersAsync();
    const result = await pending;
    if (result.error) throw result.error;
    return result.value;
}

let auth;
let unsubscribes;
beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "debug").mockImplementation(() => {});
    auth = new LocalTestAuth();
    unsubscribes = [];
});
afterEach(() => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
});
const register = () => run(auth.createUserWithEmailAndPassword("user@example.test", "password"));
const stored = () => JSON.parse(window.localStorage.getItem(auth.storageKey));

it("constructs without accessing storage and validates its namespace", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    expect(new LocalTestAuth()).toBeInstanceOf(LocalTestAuth);
    expect(getItem).not.toHaveBeenCalled();
    expect(() => new LocalTestAuth({storageKey: ""})).toThrow();
});
it("registers, normalizes email and restores detached user snapshots", async () => {
    const {user} = await run(auth.createUserWithEmailAndPassword(" User@Example.test ", "password"));
    expect(user).toMatchObject({email: "user@example.test", emailVerified: false});
    expect(user.toJSON()).not.toHaveProperty("password");
    expect(user.toJSON()).not.toHaveProperty("token");
    expect(await run(new LocalTestAuth().resolveCurrentUser())).toMatchObject({uid: user.uid});
    const parsed = auth.from(user.toJSON());
    expect(parsed).toMatchObject({id: user.uid, public: {email: user.email, provider: "password"}, loaded: {public: true}});
    expect(parsed.requestedTimestamp).toBeInstanceOf(Date);
    user.displayName = "Unsaved";
    expect((await run(auth.resolveCurrentUser())).displayName).toBeNull();
});
it.each([
    ["invalid", "password", "invalid-email"],
    ["user@example.test", "short", "weak-password"]
])("rejects invalid registration: %s", async (email, password, code) => {
    await expect(run(auth.createUserWithEmailAndPassword(email, password))).rejects.toMatchObject({code: `auth/${code}`});
    expect(window.localStorage.getItem(auth.storageKey)).toBeNull();
});
it("rejects duplicates and invalid credentials without changing the session", async () => {
    const {user} = await register();
    await expect(register()).rejects.toMatchObject({code: "auth/email-already-in-use"});
    await expect(run(auth.signInWithEmailAndPassword(user.email, "wrong"))).rejects.toMatchObject({code: "auth/invalid-credential"});
    await expect(run(auth.signInWithEmailAndPassword("missing@example.test", "password"))).rejects.toMatchObject({code: "auth/invalid-credential"});
    expect((await run(auth.resolveCurrentUser())).uid).toBe(user.uid);
});
it("signs out while preserving accounts and permits subsequent password login", async () => {
    const {user} = await register();
    await run(auth.signOut());
    expect(await run(auth.resolveCurrentUser())).toBeNull();
    expect(await run(auth.resolveToken())).toBeNull();
    expect(stored().accounts).toHaveLength(1);
    expect((await run(auth.signInWithEmailAndPassword(user.email, "password"))).user.uid).toBe(user.uid);
});
it("isolates keys while sharing sessions between matching namespaces", async () => {
    const {user} = await register();
    expect((await run(new LocalTestAuth().resolveCurrentUser())).uid).toBe(user.uid);
    const separate = new LocalTestAuth({storageKey: "separate"});
    expect(await run(separate.resolveCurrentUser())).toBeNull();
    await run(separate.signOut());
    expect((await run(auth.resolveCurrentUser())).uid).toBe(user.uid);
});
it("updates profile and password through both Auth and the resolved user", async () => {
    const {user} = await register();
    await run(auth.updateProfile({displayName: "Tester", photoURL: "https://example.test/photo"}));
    await run(auth.updatePassword("changed-password"));
    await run(user.updatePassword("final-password"));
    await run(auth.signOut());
    await expect(run(auth.signInWithEmailAndPassword(user.email, "password"))).rejects.toMatchObject({code: "auth/invalid-credential"});
    const restored = (await run(auth.signInWithEmailAndPassword(user.email, "final-password"))).user;
    expect(restored).toMatchObject({displayName: "Tester", photoURL: "https://example.test/photo"});
    await run(auth.updateProfile({displayName: null, photoURL: null}));
    expect(await run(auth.resolveCurrentUser())).toMatchObject({displayName: null, photoURL: null});
});
it("rejects stale-user password changes and invalid profile fields", async () => {
    const {user} = await register();
    await run(auth.signInWithPopup("google"));
    await expect(run(user.updatePassword("password"))).rejects.toMatchObject({code: "auth/user-mismatch"});
    await expect(run(auth.updateProfile({displayName: "Unsaved", photoURL: 42}))).rejects.toMatchObject({code: "auth/invalid-argument"});
    expect((await run(auth.resolveCurrentUser())).displayName).toBe("Local Test Google");
    await run(auth.signOut());
    await expect(run(auth.updatePassword("password"))).rejects.toMatchObject({code: "auth/no-current-user"});
    await expect(run(auth.sendEmailVerification())).rejects.toMatchObject({code: "auth/no-current-user"});
});
it("uses stable fake providers and rejects collisions and unsupported credentials", async () => {
    const google = (await run(auth.signInWithPopup("google.com"))).user;
    expect(google).toMatchObject({email: "google@local-test.example", emailVerified: true});
    expect((await run(auth.signInWithCredential("fake-token"))).user.uid).toBe(google.uid);
    expect((await run(auth.signInWithCredential({provider: "facebook", accessToken: "fake"}))).user.email).toBe("facebook@local-test.example");
    expect((await run(auth.signInWithPopup({providerId: "google.com"}))).user.uid).toBe(google.uid);
    await expect(run(auth.signInWithCredential(""))).rejects.toMatchObject({code: "auth/invalid-credential"});
    await expect(run(auth.signInWithPopup("unknown"))).rejects.toMatchObject({code: "auth/operation-not-supported"});
    const separate = new LocalTestAuth({storageKey: "collision"});
    await run(separate.createUserWithEmailAndPassword("google@local-test.example", "password"));
    await expect(run(separate.signInWithPopup("google"))).rejects.toMatchObject({code: "auth/account-exists-with-different-credential"});
});
it("persists and consumes redirect results once", async () => {
    await run(auth.signInWithRedirect("facebook.com"));
    const reloaded = new LocalTestAuth();
    expect((await run(reloaded.resolveRedirectResult())).user.email).toBe("facebook@local-test.example");
    expect(await run(auth.resolveRedirectResult())).toBeNull();
});
it("simulates email verification, records reset requests and consumes email sign-in requests", async () => {
    const {user} = await register();
    await run(auth.sendEmailVerification());
    expect((await run(auth.resolveCurrentUser())).emailVerified).toBe(true);
    await run(auth.sendPasswordResetEmail(user.email, {url: "https://example.test/reset"}));
    expect(stored().accounts[0].password).toBe("password");
    await expect(run(auth.sendPasswordResetEmail("missing@example.test"))).rejects.toMatchObject({code: "auth/user-not-found"});
    await run(auth.sendSignInLinkToEmail(" LINK@Example.test "));
    expect(await run(auth.checkSignInWithEmailLink())).toBe(true);
    await expect(run(auth.signInWithEmailLink("missing@example.test"))).rejects.toMatchObject({code: "auth/invalid-action-code"});
    const link = (await run(auth.signInWithEmailLink("link@example.test"))).user;
    expect(link.emailVerified).toBe(true);
    expect(await run(auth.checkSignInWithEmailLink())).toBe(false);
    await run(link.updatePassword("password"));
    await run(auth.sendSignInLinkToEmail(link.email));
    expect((await run(auth.signInWithEmailLink(link.email))).user.uid).toBe(link.uid);
    expect(stored().mail).toEqual(expect.arrayContaining([
        expect.objectContaining({type: "verification", email: user.email}),
        expect.objectContaining({type: "password-reset", url: "https://example.test/reset"}),
        expect.objectContaining({type: "sign-in", email: link.email})
    ]));
});
it("notifies peers on user changes but not on token refresh or reset requests", async () => {
    const callback = vi.fn();
    unsubscribes.push(await run(new LocalTestAuth().onAuthStateChanged(callback)));
    expect(callback).toHaveBeenLastCalledWith(null);
    await register();
    expect(callback).toHaveBeenCalledTimes(2);
    const token = await run(auth.resolveToken());
    expect(await run(new LocalTestAuth().resolveToken())).toBe(token);
    expect(await run(auth.resolveToken(true))).not.toBe(token);
    await run(auth.sendPasswordResetEmail("user@example.test"));
    expect(callback).toHaveBeenCalledTimes(2);
    await run(auth.updateProfile({displayName: "Changed"}));
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({displayName: "Changed"}));
    await run(auth.signOut());
    expect(callback).toHaveBeenLastCalledWith(null);
    unsubscribes[0]();
    const calls = callback.mock.calls.length;
    await register().catch(() => run(auth.signInWithEmailAndPassword("user@example.test", "password")));
    expect(callback).toHaveBeenCalledTimes(calls);
});
it("observes cross-tab storage changes and clearing the namespace", async () => {
    await register();
    const callback = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(callback)));
    const state = stored();
    state.accounts[0].displayName = "Other tab";
    window.localStorage.setItem(auth.storageKey, JSON.stringify(state));
    window.dispatchEvent(new window.StorageEvent("storage", {key: auth.storageKey, storageArea: window.localStorage}));
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({displayName: "Other tab"}));
    window.localStorage.removeItem(auth.storageKey);
    window.dispatchEvent(new window.StorageEvent("storage", {key: null, storageArea: window.localStorage}));
    expect(callback).toHaveBeenLastCalledWith(null);
});
it("preserves corrupt documents and reports subscription errors", async () => {
    const onError = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(vi.fn(), onError)));
    window.localStorage.setItem(auth.storageKey, "broken");
    window.dispatchEvent(new window.StorageEvent("storage", {key: auth.storageKey, storageArea: window.localStorage}));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "auth/invalid-storage"}));
    await expect(run(auth.resolveCurrentUser())).rejects.toMatchObject({code: "auth/invalid-storage"});
    await expect(run(auth.onAuthStateChanged(vi.fn()))).rejects.toMatchObject({code: "auth/invalid-storage"});
    expect(window.localStorage.getItem(auth.storageKey)).toBe("broken");
    window.localStorage.setItem(auth.storageKey, JSON.stringify({version: 999}));
    await expect(run(auth.signOut())).rejects.toMatchObject({code: "auth/invalid-storage"});
});
it("rejects failed reads and writes without publishing successful changes", async () => {
    await register();
    const callback = vi.fn();
    unsubscribes.push(await run(auth.onAuthStateChanged(callback)));
    const before = window.localStorage.getItem(auth.storageKey);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    await expect(run(auth.signOut())).rejects.toMatchObject({code: "auth/storage-unavailable"});
    expect(callback).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(auth.storageKey)).toBe(before);
    write.mockRestore();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("disabled"); });
    await expect(run(auth.resolveCurrentUser())).rejects.toMatchObject({code: "auth/storage-unavailable"});
});
it.each([0, 100, 101, 2000])("waits %i ms and logs only delays greater than 100 ms", async milliseconds => {
    Math.random.mockReturnValue((milliseconds + 0.1) / 2001);
    const before = Date.now();
    await run(auth.resolveCurrentUser());
    expect(Date.now() - before).toBe(milliseconds);
    expect(console.debug).toHaveBeenCalledTimes(milliseconds > 100 ? 1 : 0);
    if (milliseconds > 100) expect(console.debug).toHaveBeenCalledWith(`[LocalTestAuth] resolveCurrentUser: ${milliseconds} ms`);
});
it("delays password updates once and keeps from synchronous", async () => {
    const {user} = await register();
    Math.random.mockReturnValue(101.1 / 2001);
    console.debug.mockClear();
    const before = Date.now();
    await run(user.updatePassword("new-password"));
    expect(Date.now() - before).toBe(101);
    expect(console.debug).toHaveBeenCalledTimes(1);
    expect(auth.from(user.toJSON())).not.toBeInstanceOf(Promise);
    expect(Date.now() - before).toBe(101);
});
