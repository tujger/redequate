import {vi} from "vitest";

it("registers on module import, caches ordinary imports and rejects repeated execution", async () => {
    const {default: hook} = await import("./fixtures/registeredState");
    const again = await import("./fixtures/registeredState");
    const {default: UseAbstract} = await import("../../controllers/AppContext/UseAbstract");
    expect(again.default).toBe(hook);
    expect(hook.get()).toEqual({count: 1});
    hook.set({count: 2});
    expect(() => new UseAbstract("module-registration", {count: 1})).toThrow("already registered");
    class Incompatible extends UseAbstract {
        _normalize() { return "incompatible"; }
    }
    expect(() => new Incompatible("module-registration", "different")).toThrow("already registered");
    expect(hook.get()).toEqual({count: 2});
    // A full module reset starts a new registry, without reusing incompatible stores.
    vi.resetModules();
    const reloaded = await import("./fixtures/registeredState");
    expect(reloaded.default).not.toBe(hook);
    expect(reloaded.default.get()).toEqual({count: 1});
    expect(hook.get()).toEqual({count: 2});
});
