import {vi} from "vitest";
import {getAuth} from "firebase/auth";

import LocalTestAuth from "../local-test";
import FirebaseAuth from "../firebase";
import {resolveAuth} from "../resolveAuth";

vi.mock("firebase/auth", () => ({getAuth: vi.fn(app => app)}));

it("creates LocalTestAuth by default without reading or writing storage", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const first = await resolveAuth();
    const second = await resolveAuth();
    expect(first).toBeInstanceOf(LocalTestAuth);
    expect(second).toBeInstanceOf(LocalTestAuth);
    expect(first).not.toBe(second);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
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
it.each([null, [], LocalTestAuth, "local-test", false, 0])("rejects invalid explicit selection %s", async value => {
    await expect(resolveAuth(value)).rejects.toThrow("Dispatcher auth must be an Auth instance");
});
