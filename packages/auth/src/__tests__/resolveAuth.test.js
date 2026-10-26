import {installIndexedDB, flushIndexedDB} from "./fixtures/indexedDB";
import {vi} from "vitest";
import {getAuth} from "firebase/auth";
import {UserData} from "../../../common";

import LocalAuth from "../local";
import FirebaseAuth from "../firebase";
import resolveAuth from "../resolveAuth";

vi.mock("firebase/auth", () => ({getAuth: vi.fn(app => app)}));
beforeEach(() => installIndexedDB());

it("creates LocalAuth by default without reading or writing storage", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const database = {read: vi.fn()};
    class CustomUserData extends UserData {}
    const first = await resolveAuth(undefined, {database, UserData: CustomUserData, storageId: "custom:auth"});
    const second = await resolveAuth();
    expect(first).toBeInstanceOf(LocalAuth);
    expect(first.database).toBe(database);
    expect(first.storageId).toBe("custom:auth");
    expect(second).toBeInstanceOf(LocalAuth);
    expect(first).not.toBe(second);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
});
it("uses the default model for implicit auth and accepts a constructor model", async () => {
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "Date"]});
    try {
        class CustomUserData extends UserData {}
        const defaultAuth = await resolveAuth();
        const customAuth = await resolveAuth(undefined, {UserData: CustomUserData});
        const restored = Promise.all([defaultAuth.resolveCurrentUser(), customAuth.resolveCurrentUser()]);
        await vi.runAllTimersAsync();
    await flushIndexedDB();
        const [defaultUser, customUser] = await restored;
        expect(defaultUser.constructor).toBe(UserData);
        expect(customUser).toBeInstanceOf(CustomUserData);
    } finally {
        vi.useRealTimers();
    }
});
it.each([LocalAuth, FirebaseAuth])("preserves the constructor configuration of an existing %s", async Auth => {
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "Date"]});
    try {
        const firebase = {app: {currentUser: null, authStateReady: vi.fn().mockResolvedValue()}};
        const originalDatabase = {read: vi.fn()};
        class OriginalUserData extends UserData {}
        class CustomUserData extends UserData {}
        const auth = new Auth({firebase, database: originalDatabase, UserData: OriginalUserData});
        const initializations = getAuth.mock.calls.length;
        expect(await resolveAuth(auth)).toBe(auth);
        expect(await resolveAuth(auth, {
            database: {read: vi.fn()}, UserData: CustomUserData, storageId: "ignored"
        })).toBe(auth);
        expect(auth.database).toBe(originalDatabase);
        const restored = auth.resolveCurrentUser();
        await vi.runAllTimersAsync();
    await flushIndexedDB();
        expect(await restored).toBeInstanceOf(OriginalUserData);
        expect(auth.storageId).not.toBe("ignored");
        expect(getAuth).toHaveBeenCalledTimes(initializations);
    } finally {
        vi.useRealTimers();
    }
});
it("preserves explicitly configured Firebase and structural Auth instances", async () => {
    const firebase = {app: {}};
    const explicit = new FirebaseAuth({firebase});
    expect(await resolveAuth(explicit)).toBe(explicit);
    expect(getAuth).toHaveBeenCalledWith(firebase.app);
    expect(getAuth).toHaveBeenCalledTimes(1);
    const external = {signOut: vi.fn()};
    expect(await resolveAuth(external)).toBe(external);
    expect(external.signOut).not.toHaveBeenCalled();
    expect(() => new FirebaseAuth()).toThrow();
});
it.each([null, [], LocalAuth, "local", false, 0])("rejects invalid explicit selection %s", async value => {
    await expect(resolveAuth(value)).rejects.toThrow("Dispatcher auth must be an Auth instance");
});
