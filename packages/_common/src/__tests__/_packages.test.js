import {vi} from "vitest";
import {delay, fail, notImplemented, identifier, resolvePackage} from "../_packages";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it("keeps full error codes and abstract method names", () => {
    expect(() => fail("storage/example", "failure")).toThrow("failure");
    try { fail("auth/example", "failure"); } catch (error) { expect(error.code).toBe("auth/example"); }
    expect(() => notImplemented("subscribe")).toThrow("Not implemented: subscribe");
});
it.each([0, 100, 101, 2000])("delays %i ms and logs only above 100", async milliseconds => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue((milliseconds + 0.1) / 2001);
    const log = vi.spyOn(console, "debug").mockImplementation(() => {});
    const before = Date.now();
    const pending = delay("LocalTestStorage", "upload");
    await vi.runAllTimersAsync();
    await pending;
    expect(Date.now() - before).toBe(milliseconds);
    if (milliseconds > 100) expect(log).toHaveBeenCalledWith(`[LocalTestStorage] upload: ${milliseconds} ms`);
    else expect(log).not.toHaveBeenCalled();
});
it("uses browser UUID generation", () => {
    vi.spyOn(window.crypto, "randomUUID").mockReturnValue("uuid");
    expect(identifier()).toBe("uuid");
});
it("loads defaults only for undefined and preserves explicit instances", async () => {
    const instance = {};
    const loader = vi.fn().mockResolvedValue(instance);
    expect(await resolvePackage(instance, "auth", loader)).toBe(instance);
    expect(loader).not.toHaveBeenCalled();
    expect(await resolvePackage(undefined, "auth", loader)).toBe(instance);
    expect(loader).toHaveBeenCalledOnce();
});
it.each([null, [], 1, "auth", () => {}])("rejects invalid instance %s before loading", async instance => {
    const loader = vi.fn();
    await expect(resolvePackage(instance, "auth", loader)).rejects.toThrow("Dispatcher auth must be an Auth instance created with new Auth(...)");
    expect(loader).not.toHaveBeenCalled();
});
it("preserves loader failures", async () => {
    const error = new Error("loader failure");
    await expect(resolvePackage(undefined, "storage", () => Promise.reject(error))).rejects.toBe(error);
});
