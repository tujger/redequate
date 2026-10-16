import {vi} from "vitest";
import FirebaseAuth from "../firebase";
import * as modularAuth from "firebase/auth";

vi.mock("firebase/auth", () => {
    const methods = ["createUserWithEmailAndPassword", "signInWithEmailAndPassword", "signInWithEmailLink", "signInWithPopup", "signInWithCredential", "onAuthStateChanged", "getRedirectResult", "signInWithRedirect", "signOut", "isSignInWithEmailLink", "sendPasswordResetEmail", "sendSignInLinkToEmail", "updatePassword", "updateProfile", "sendEmailVerification"];
    const GoogleAuthProvider = vi.fn();
    GoogleAuthProvider.credential = vi.fn(() => "credential");
    return {
        getAuth: vi.fn(app => Object.assign(app, {authStateReady: vi.fn().mockResolvedValue()})),
        GoogleAuthProvider,
        FacebookAuthProvider: vi.fn(),
        ...Object.fromEntries(methods.map(method => [method, vi.fn((target, ...args) => target[method](...args))])),
    };
});
beforeEach(() => vi.clearAllMocks());

const json = {
    uid: "sdk-user",
    email: "sdk@example.test",
    displayName: "SDK User",
    photoURL: "https://example.test/photo",
    emailVerified: true,
    createdAt: "1234",
    lastLoginAt: "5678",
    providerData: [{providerId: "password"}]
};
const sdkUser = (data = json) => ({...data, toJSON: () => structuredClone(data), updatePassword: vi.fn(), getIdToken: vi.fn()});

it.each(["createUserWithEmailAndPassword", "signInWithEmailAndPassword", "signInWithEmailLink", "signInWithPopup", "signInWithCredential"])(
    "normalizes %s inside FirebaseAuth", async method => {
        const raw = sdkUser();
        const sdk = {[method]: vi.fn().mockResolvedValue({user: raw, credential: {secret: "hidden"}, additionalUserInfo: {isNewUser: true}})};
        const firebase = {app: sdk};
        const auth = new FirebaseAuth({firebase});
        expect(modularAuth.getAuth).toHaveBeenCalledWith(firebase.app);
        const result = await auth[method]("sdk@example.test", "password");
        expect(result).toMatchObject({id: json.uid, _userData: true, name: json.displayName, email: json.email, verified: true, image: json.photoURL});
        expect(result.public).toMatchObject({created: 1234, lastLogin: 5678, provider: "password"});
        expect(result).not.toHaveProperty("user");
        expect(result).not.toHaveProperty("uid");
        expect(result).not.toHaveProperty("credential");
        expect(result).not.toHaveProperty("updatePassword");
        expect(result).not.toHaveProperty("getIdToken");
        result.public.name = "Changed";
        expect(raw.displayName).toBe(json.displayName);
    }
);
it("normalizes redirect results and uses null only when no result exists", async () => {
    const getRedirectResult = vi.fn().mockResolvedValueOnce({user: sdkUser()}).mockResolvedValueOnce({user: null});
    const auth = new FirebaseAuth({firebase: {app: {getRedirectResult}}});
    expect(await auth.resolveRedirectResult()).toMatchObject({id: json.uid, _userData: true});
    expect(await auth.resolveRedirectResult()).toBeNull();
});
it("normalizes restored users and subscription updates including errors", async () => {
    let notify, notifyError;
    const stop = vi.fn();
    const sdk = {
        currentUser: sdkUser(),
        onAuthStateChanged: (callback, onError) => {
            notify = callback;
            notifyError = onError;
            return stop;
        }
    };
    const auth = new FirebaseAuth({firebase: {app: sdk}});
    const callback = vi.fn();
    const onError = vi.fn();
    const unsubscribe = await auth.onAuthStateChanged(callback, onError);
    expect(await auth.resolveCurrentUser()).toMatchObject({id: json.uid, _userData: true});
    notify(sdk.currentUser);
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({id: json.uid, _userData: true}));
    notify(null);
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({_userData: true, id: undefined}));
    const providerError = Object.assign(new Error("Failed"), {code: "auth/example"});
    notifyError(providerError);
    expect(onError).toHaveBeenLastCalledWith(providerError);
    expect(onError.mock.calls.at(-1)[0].code).toBe("auth/example");
    notify(sdkUser({uid: null}));
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({code: "auth/invalid-user-data"}));
    unsubscribe();
    expect(stop).toHaveBeenCalledOnce();
});
it("passes provider failures through unchanged", async () => {
    const error = Object.assign(new Error("Invalid login"), {code: "auth/invalid-credential"});
    const rejected = {message: "Provider rejected", code: "auth/provider-error"};
    const signInWithEmailAndPassword = vi.fn().mockRejectedValueOnce(error).mockRejectedValueOnce(rejected);
    const auth = new FirebaseAuth({firebase: {app: {signInWithEmailAndPassword}}});
    await expect(auth.signInWithEmailAndPassword("email", "password")).rejects.toBe(error);
    await expect(auth.signInWithEmailAndPassword("email", "password")).rejects.toBe(rejected);
});
it("handles provider-free and incomplete auth fields without SDK methods", async () => {
    const sdk = {currentUser: sdkUser({uid: "anonymous", providerData: []})};
    const auth = new FirebaseAuth({firebase: {app: sdk}});
    expect(auth).not.toHaveProperty("from");
    expect(auth).not.toHaveProperty("resolveToken");
    expect(await auth.resolveCurrentUser()).toMatchObject({id: "anonymous", verified: false, email: null});
    sdk.currentUser = sdkUser({uid: "federated", providerData: [{providerId: "google.com", email: "google@example.test"}]});
    expect(await auth.resolveCurrentUser()).toMatchObject({email: "google@example.test", verified: true});
    sdk.currentUser = sdkUser({uid: ""});
    await expect(auth.resolveCurrentUser()).rejects.toThrow(Error);
});
it("forwards login arguments, browser links and sign-out to the SDK", async () => {
    const methods = ["createUserWithEmailAndPassword", "signInWithEmailAndPassword", "signInWithEmailLink", "signInWithCredential", "signInWithPopup", "signInWithRedirect", "signOut", "isSignInWithEmailLink", "sendPasswordResetEmail", "sendSignInLinkToEmail"];
    const sdk = Object.fromEntries(methods.map(method => [method, vi.fn().mockResolvedValue({user: null})]));
    const credential = {};
    const provider = {};
    const credentialFactory = modularAuth.GoogleAuthProvider.credential.mockReturnValue(credential);
    const auth = new FirebaseAuth({firebase: {app: sdk}});
    for (const method of ["createUserWithEmailAndPassword", "signInWithEmailAndPassword"]) {
        await auth[method]("email", "password");
        expect(sdk[method]).toHaveBeenCalledWith("email", "password");
        expect(modularAuth[method]).toHaveBeenCalledWith(sdk, "email", "password");
    }
    await auth.signInWithEmailLink("email");
    expect(sdk.signInWithEmailLink).toHaveBeenCalledWith("email", window.location.href);
    await auth.checkSignInWithEmailLink();
    expect(sdk.isSignInWithEmailLink).toHaveBeenCalledWith(window.location.href);
    await auth.signInWithCredential("token");
    expect(credentialFactory).toHaveBeenCalledWith("token");
    expect(sdk.signInWithCredential).toHaveBeenCalledWith(credential);
    for (const method of ["signInWithPopup", "signInWithRedirect"]) {
        await auth[method](provider);
        expect(sdk[method]).toHaveBeenCalledWith(provider);
    }
    await auth.signOut();
    expect(sdk.signOut).toHaveBeenCalledWith();
    await auth.sendPasswordResetEmail("email");
    expect(sdk.sendPasswordResetEmail).toHaveBeenCalledWith("email");
    await auth.sendSignInLinkToEmail("email");
    expect(sdk.sendSignInLinkToEmail).toHaveBeenCalledWith("email", {url: window.location.origin + "/signup/email", handleCodeInApp: true});
});
it("uses modular current user operations and reports missing authentication with the full error", async () => {
    const user = {updatePassword: vi.fn().mockResolvedValue("password result"), updateProfile: vi.fn().mockResolvedValue("profile result"), sendEmailVerification: vi.fn().mockResolvedValue("verification result")};
    const sdk = {currentUser: user};
    const auth = new FirebaseAuth({firebase: {app: sdk}});
    expect(auth.currentUser()).toBe(user);
    expect(await auth.updatePassword("new password")).toBe("password result");
    expect(modularAuth.updatePassword).toHaveBeenCalledWith(user, "new password");
    expect(await auth.updateProfile({displayName: "name"})).toBe("profile result");
    expect(modularAuth.updateProfile).toHaveBeenCalledWith(user, {displayName: "name"});
    expect(await auth.sendEmailVerification()).toBe("verification result");
    expect(modularAuth.sendEmailVerification).toHaveBeenCalledWith(user);
    sdk.currentUser = null;
    const expected = {code: "auth/no-current-user", message: "An authenticated user is required."};
    try { auth.currentUser(); throw new Error("Expected authentication failure"); } catch (error) { expect(error).toMatchObject(expected); }
    for (const method of ["updatePassword", "updateProfile", "sendEmailVerification"]) {
        await expect(auth[method]({})).rejects.toMatchObject(expected);
    }
    expect(await auth.resolveCurrentUser()).toMatchObject({_userData: true, id: undefined});
});
it("configures Google and Facebook providers and preserves explicit providers", () => {
    const google = {setCustomParameters: vi.fn(), addScope: vi.fn()};
    const facebook = {addScope: vi.fn(), setCustomParameters: vi.fn()};
    const Google = vi.fn(function () { return google; });
    const Facebook = vi.fn(function () { return facebook; });
    modularAuth.GoogleAuthProvider.mockImplementation(Google);
    modularAuth.FacebookAuthProvider.mockImplementation(Facebook);
    const auth = new FirebaseAuth({firebase: {app: {}}});
    expect(auth.provider("google.com")).toBe(google);
    expect(google.setCustomParameters).toHaveBeenCalledWith({prompt: "select_account"});
    expect(google.addScope).toHaveBeenCalledWith("https://www.googleapis.com/auth/userinfo.email");
    expect(auth.provider("facebook.com")).toBe(facebook);
    expect(facebook.addScope).toHaveBeenCalledWith("email");
    expect(facebook.setCustomParameters).toHaveBeenCalledWith({prompt: "select_account"});
    const explicit = {};
    expect(auth.provider(explicit)).toBe(explicit);
});
it.each([[null, undefined], [() => {}, null], ["callback", () => {}]])("rejects invalid observers before SDK registration", async (callback, onError) => {
    const sdk = vi.fn();
    const auth = new FirebaseAuth({firebase: {app: {onAuthStateChanged: sdk}}});
    await expect(auth.onAuthStateChanged(callback, onError)).rejects.toMatchObject({code: "auth/invalid-argument", message: "Auth state listeners must be functions."});
    expect(sdk).not.toHaveBeenCalled();
});
it("contains synchronous and asynchronous observers and error callback failures", async () => {
    let notify;
    const auth = new FirebaseAuth({firebase: {app: {onAuthStateChanged: callback => { notify = callback; }}}});
    const sync = new Error("sync observer");
    const asyncError = new Error("async observer");
    const onError = vi.fn();
    await auth.onAuthStateChanged(() => { throw sync; }, onError);
    expect(() => notify(null)).not.toThrow();
    expect(onError).toHaveBeenLastCalledWith(sync);
    await auth.onAuthStateChanged(async () => { throw asyncError; }, onError);
    notify(null);
    await Promise.resolve();
    expect(onError).toHaveBeenLastCalledWith(asyncError);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await auth.onAuthStateChanged(async () => { throw asyncError; });
    notify(null);
    await Promise.resolve();
    expect(log).toHaveBeenCalledWith("[FirebaseAuth] Auth state observer failed", asyncError);
    const reportingError = new Error("error callback");
    await auth.onAuthStateChanged(() => { throw sync; }, () => { throw reportingError; });
    expect(() => notify(null)).not.toThrow();
    expect(log).toHaveBeenCalledWith("[FirebaseAuth] Auth error callback failed", reportingError);
});
