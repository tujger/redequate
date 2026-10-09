import {vi} from "vitest";
import FirebaseAuth from "../firebase";

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
        const firebase = {auth: Object.assign(() => sdk, {GoogleAuthProvider: {credential: vi.fn(() => "credential")}})};
        const auth = new FirebaseAuth({firebase});
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
    const auth = new FirebaseAuth({firebase: {auth: () => ({getRedirectResult})}});
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
    const auth = new FirebaseAuth({firebase: {auth: () => sdk}});
    const callback = vi.fn();
    const onError = vi.fn();
    const unsubscribe = await auth.onAuthStateChanged(callback, onError);
    expect(await auth.resolveCurrentUser()).toMatchObject({id: json.uid, _userData: true});
    notify(sdk.currentUser);
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({id: json.uid, _userData: true}));
    notify(null);
    expect(callback).toHaveBeenLastCalledWith(null);
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
    const auth = new FirebaseAuth({firebase: {auth: () => ({signInWithEmailAndPassword})}});
    await expect(auth.signInWithEmailAndPassword("email", "password")).rejects.toBe(error);
    await expect(auth.signInWithEmailAndPassword("email", "password")).rejects.toBe(rejected);
});
it("handles provider-free and incomplete auth fields without SDK methods", async () => {
    const sdk = {currentUser: sdkUser({uid: "anonymous", providerData: []})};
    const auth = new FirebaseAuth({firebase: {auth: () => sdk}});
    expect(auth).not.toHaveProperty("from");
    expect(auth).not.toHaveProperty("resolveToken");
    expect(await auth.resolveCurrentUser()).toMatchObject({id: "anonymous", verified: false, email: null});
    sdk.currentUser = sdkUser({uid: "federated", providerData: [{providerId: "google.com", email: "google@example.test"}]});
    expect(await auth.resolveCurrentUser()).toMatchObject({email: "google@example.test", verified: true});
    sdk.currentUser = sdkUser({uid: ""});
    await expect(auth.resolveCurrentUser()).rejects.toThrow(Error);
});
