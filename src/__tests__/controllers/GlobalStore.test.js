import {vi} from "vitest";
import GlobalStore from "../../controllers/AppContext/GlobalStore";

describe.each(["development", "production"])("GlobalStore in %s", environment => {
    beforeEach(() => vi.stubEnv("NODE_ENV", environment));
    afterEach(() => vi.unstubAllEnvs());

    it("preserves identities and freezes nested data before notifying", () => {
        const initial = {items: [{count: 1}]};
        const store = new GlobalStore(initial);
        expect(store.get()).toBe(initial);
        expect(store.getServerSnapshot()).toBe(initial);
        expect(() => { initial.items[0].count++; }).toThrow(TypeError);
        expect(() => initial.items.push({count: 2})).toThrow(TypeError);
        const listener = vi.fn(() => {
            expect(Object.isFrozen(store.get().items[0])).toBe(true);
        });
        store.subscribe(listener);
        const next = {items: [{count: 2}]};
        store.set(next);
        expect(store.get()).toBe(next);
        expect(listener).toHaveBeenCalledTimes(1);
        next.items.forEach(item => expect(Object.isFrozen(item)).toBe(true));
        expect(store.getServerSnapshot()).toBe(initial);
    });

    it("supports functional updates and suppresses unchanged snapshots", () => {
        const store = new GlobalStore({count: 0});
        const listener = vi.fn();
        store.subscribe(listener);
        store.set(previous => ({count: previous.count + 1}));
        expect(store.get()).toEqual({count: 1});
        store.set(previous => previous);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(() => store.set(previous => { previous.count++; return previous; })).toThrow(TypeError);
        expect(store.get()).toEqual({count: 1});
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("normalizes inputs once and resets to the exact prepared initial value", () => {
        const normalize = vi.fn(value => ({count: value.count + 1}));
        const store = new GlobalStore({count: 0}, normalize);
        const initial = store.get();
        const fork = store.fork();
        expect(fork.get()).toBe(initial);
        expect(normalize).toHaveBeenCalledTimes(1);
        expect(store.fork({count: 10}).get()).toEqual({count: 11});
        const listener = vi.fn();
        store.subscribe(listener);
        store.set(previous => ({count: previous.count + 1}));
        expect(store.get()).toEqual({count: 3});
        store.reset();
        store.reset();
        expect(store.get()).toBe(initial);
        expect(normalize).toHaveBeenCalledTimes(3);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("compares the normalized value and retains state when preparation fails", () => {
        const initial = {count: 1};
        const store = new GlobalStore(initial, value => value === null ? initial : value);
        const listener = vi.fn();
        store.subscribe(listener);
        store.set(null);
        expect(listener).not.toHaveBeenCalled();
        expect(() => store.set(() => { throw new Error("updater"); })).toThrow("updater");
        expect(() => store.set({nested: new Map()})).toThrow("mutable built-in");
        expect(store.get()).toBe(initial);
        expect(listener).not.toHaveBeenCalled();
        const normalized = new GlobalStore(1, value => {
            if (value === 2) throw new Error("normalizer");
            return value;
        });
        expect(() => normalized.set(2)).toThrow("normalizer");
        expect(normalized.get()).toBe(1);
    });

    it("handles cycles, symbols, nonenumerable fields and already shallow-frozen objects", () => {
        const symbol = Symbol("nested");
        const value = {nested: {}, [symbol]: {count: 1}};
        value.self = value;
        Object.defineProperty(value, "hidden", {value: {count: 2}});
        Object.freeze(value);
        const store = new GlobalStore(value);
        expect(store.get()).toBe(value);
        expect(() => { value.nested.newField = 1; }).toThrow(TypeError);
        expect(() => { value[symbol].count++; }).toThrow(TypeError);
        expect(() => { value.hidden.count++; }).toThrow(TypeError);
    });

    it("retains class methods and getters without invoking them or freezing functions", () => {
        const getter = vi.fn(() => { throw new Error("getter invoked"); });
        const method = vi.fn();
        class Model {
            data = {count: 1};
            method = method;
        }
        const model = new Model();
        Object.defineProperty(model, "derived", {get: getter});
        Object.defineProperty(model, Symbol.toStringTag, {get: getter});
        const store = new GlobalStore(model);
        expect(store.get()).toBe(model);
        expect(getter).not.toHaveBeenCalled();
        expect(model).toBeInstanceOf(Model);
        expect(model.method).toBe(method);
        expect(Object.isFrozen(method)).toBe(false);
        expect(Object.isFrozen(model.data)).toBe(true);
    });

    it.each([
        ["Date", () => new Date()], ["Map", () => new Map()],
        ["Set", () => new Set()], ["WeakMap", () => new WeakMap()],
        ["WeakSet", () => new WeakSet()], ["ArrayBuffer", () => new ArrayBuffer(8)],
        ["SharedArrayBuffer", () => new SharedArrayBuffer(8)],
        ["DataView", () => new DataView(new ArrayBuffer(8))],
        ["typed array", () => new Uint8Array(8)], ["RegExp", () => /value/g],
        ["URL", () => new URL("https://example.test/")],
        ["URLSearchParams", () => new URLSearchParams("a=1")],
    ])("rejects nested %s before freezing the input", (name, makeValue) => {
        const input = {valid: {}, invalid: makeValue()};
        expect(() => new GlobalStore(input)).toThrow("mutable built-in");
        expect(Object.isFrozen(input)).toBe(false);
        expect(Object.isFrozen(input.valid)).toBe(false);
    });
});

it("handles deeply nested data without recursive stack overflow", () => {
    let value = {count: 1};
    for (let index = 0; index < 15000; index++) value = {child: value};
    const store = new GlobalStore(value);
    while (value.child) {
        expect(Object.isFrozen(value)).toBe(true);
        value = value.child;
    }
    expect(Object.isFrozen(value)).toBe(true);
    expect(store.get()).toBe(store.getServerSnapshot());
});

it("unsubscribes idempotently and isolates fork listeners", () => {
    const store = new GlobalStore(0);
    const fork = store.fork();
    const listener = vi.fn();
    const forkListener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    fork.subscribe(forkListener);
    store.set(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(forkListener).not.toHaveBeenCalled();
    unsubscribe();
    unsubscribe();
    store.set(2);
    fork.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(forkListener).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(2);
});

it("defers new listeners and skips listeners removed during notification", () => {
    const store = new GlobalStore(0);
    const added = vi.fn();
    const removed = vi.fn();
    store.subscribe(() => { store.subscribe(added); unsubscribe(); });
    const unsubscribe = store.subscribe(removed);
    store.set(1);
    expect(added).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    store.set(2);
    expect(added).toHaveBeenCalledTimes(1);
});

it("preserves Object.is semantics for primitive snapshots", () => {
    const store = new GlobalStore(NaN);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(NaN);
    expect(listener).not.toHaveBeenCalled();
    store.set(0);
    store.set(-0);
    expect(listener).toHaveBeenCalledTimes(2);
    store.set(undefined);
    expect(store.get()).toBeUndefined();
});

it("preserves a normalized undefined baseline when forking and resetting", () => {
    const store = new GlobalStore(null, () => undefined);
    const fork = store.fork();
    expect(fork.get()).toBeUndefined();
    expect(fork.getServerSnapshot()).toBeUndefined();
    fork.reset();
    expect(fork.get()).toBeUndefined();
});

it("does not traverse previously prepared branches on repeated writes", () => {
    const branch = {items: [{count: 1}]};
    const store = new GlobalStore({branch});
    const ownKeys = vi.spyOn(Reflect, "ownKeys");
    store.set(store.get());
    store.fork();
    expect(ownKeys).not.toHaveBeenCalled();
    const next = {branch, count: 2};
    store.set(next);
    expect(ownKeys).toHaveBeenCalledTimes(1);
    expect(ownKeys).toHaveBeenCalledWith(next);
    expect(store.get().branch).toBe(branch);
});
