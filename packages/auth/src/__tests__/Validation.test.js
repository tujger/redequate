import {vi} from "vitest";
import LocalAuth from "../local";
import FirebaseAuth from "../firebase";
import {getAuth} from "firebase/auth";

vi.mock("firebase/auth", () => ({getAuth: vi.fn(app => app)}));

beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
});

describe.each([["local", LocalAuth], ["firebase", FirebaseAuth]])("%s argument validation", (provider, Auth) => {
    it.each([
        ["sendEmailVerification", []],
        ["updateProfile", [{public: {name: "Name"}}]],
        ["createUserWithEmailAndPassword", ["user@example.test", "password"]],
    ])("requires database before %s accesses the provider", async (method, args) => {
        const sdk = {authStateReady: vi.fn()};
        const auth = new Auth({firebase: {app: sdk}});
        await expect(auth[method](...args)).rejects.toMatchObject({code: "auth/database-required"});
        expect(sdk.authStateReady).not.toHaveBeenCalled();
    });

    it.each([
        ["createUserWithEmailAndPassword", [null, "password"]],
        ["createUserWithEmailAndPassword", ["user@example.test", 123]],
        ["signInWithEmailAndPassword", [{}, "password"]],
        ["signInWithEmailAndPassword", ["user@example.test", null]],
        ["signInWithEmailLink", [undefined]],
        ["sendPasswordResetEmail", [42]],
        ["sendPasswordResetEmail", ["email", []]],
        ["sendSignInLinkToEmail", [false]],
        ["sendSignInLinkToEmail", ["email", {url: false}]],
        ["sendSignInLinkToEmail", ["email", {handleCodeInApp: "yes"}]],
        ["sendEmailVerification", [null]],
        ["updatePassword", [42]],
        ["signInWithPopup", [null]],
        ["signInWithPopup", ["google.com", {scopes: "email"}]],
        ["signInWithPopup", ["google.com", {scopes: [42]}]],
        ["signInWithPopup", ["google.com", {parameters: {prompt: false}}]],
        ["signInWithRedirect", [[]]],
        ["signInWithRedirect", ["google.com", false]],
        ["signInWithCredential", [null]],
        ["signInWithCredential", [[]]],
        ["signInWithCredential", [42]],
        ["onAuthStateChanged", [null]],
        ["onAuthStateChanged", [() => {}, "error callback"]],
        ["resolveCurrentUser", [null]],
        ["resolveCurrentUser", [{skipDelay: "yes"}]],
        ["updateProfile", [null]],
        ["updateProfile", [{public: []}]],
        ["updateProfile", [{private: "invalid"}]],
        ["updateProfile", [{role: 42}]],
    ])("rejects invalid %s arguments before provider or database access: %j", async (method, args) => {
        const database = {read: vi.fn(), update: vi.fn()};
        const sdk = {authStateReady: vi.fn()};
        const auth = new Auth({database, firebase: {app: sdk}});
        const getItem = vi.spyOn(Storage.prototype, "getItem");
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        await expect(auth[method](...args)).rejects.toMatchObject({code: "auth/invalid-argument"});
        expect(getItem).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
        expect(database.read).not.toHaveBeenCalled();
        expect(database.update).not.toHaveBeenCalled();
        expect(sdk.authStateReady).not.toHaveBeenCalled();
    });

    it.each([null, [], {database: null}, {database: []}, {UserData: {}}, {UserData: () => {}}, {storageKey: 42}])(
        "rejects invalid constructor configuration %j before SDK setup", options => {
            expect(() => new Auth(options)).toThrow(expect.objectContaining({code: "auth/invalid-argument"}));
            expect(getAuth).not.toHaveBeenCalled();
        }
    );
});
