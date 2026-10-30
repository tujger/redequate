import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local/LocalBackend";
import addEventListener from "../../local/addEventListener";
import * as helpers from "../../local/helpers";

let subscriptions;
beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("BroadcastChannel", undefined);
    vi.stubGlobal("reportError", vi.fn());
    subscriptions = [];
});
afterEach(() => {
    for (const subscription of subscriptions) subscription?.remove();
    vi.unstubAllGlobals();
});
const keep = subscription => { subscriptions.push(subscription); return subscription; };
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const queueFor = (spy, storageId) => {
    const index = spy.mock.calls.findIndex(([key, value]) => key === storageId && value instanceof Promise);
    expect(index).toBeGreaterThanOrEqual(0);
    return spy.mock.contexts[index];
};

it("propagates synchronous registration and onError failures once without logging or dummy subscriptions", () => {
    const database = new LocalDatabase(), path = ["posts", {}];
    const log = vi.spyOn(console, "error");
    expect(() => database.addEventListener(path)).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    const failure = new Error("handler failed"), onError = vi.fn(() => { throw failure; });
    expect(() => database.addEventListener(path, {onError})).toThrow(failure);
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "database/invalid-argument"}), "addEventListener", {path});
    const handled = vi.fn();
    expect(database.addEventListener(path, {onError: handled})).toBeUndefined();
    expect(handled).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
    expect(globalThis.reportError).not.toHaveBeenCalled();
});

it("reports an asynchronous read error handler failure to the host once", async () => {
    const original = new Error("read failed"), failure = new Error("handler failed");
    vi.spyOn(helpers, "readValue").mockRejectedValueOnce(original);
    const onError = vi.fn(() => { throw failure; });
    keep(new LocalDatabase().addEventListener(["posts"], {onError}));
    await vi.waitFor(() => expect(globalThis.reportError).toHaveBeenCalledExactlyOnceWith(failure));
    expect(onError).toHaveBeenCalledExactlyOnceWith(original, "addEventListener", {path: ["posts"], orderBy: undefined});
});

it("observes rejected callback promises without awaiting writes through the same listener queue", async () => {
    const storageId = "listener-reentrant", backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["posts"]);
    const failure = new Error("async handler failed"), callbackFailure = new Error("async callback failed");
    const onError = vi.fn(() => { throw failure; });
    const callback = vi.fn(async value => {
        if (value === undefined) {
            await database.create(["posts", {post_id: "p1"}], {text: "created in callback"});
            throw callbackFailure;
        }
    });
    keep(database.addEventListener(["posts"], {onChange: callback, onError}));
    await vi.waitFor(() => expect(globalThis.reportError).toHaveBeenCalledExactlyOnceWith(failure));
    expect(callback).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledExactlyOnceWith(callbackFailure, "addEventListener.onChange", {path: ["posts"], value: undefined});
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual({text: "created in callback"});
});

it("isolates a failing listener and leaves successful committed writes intact", async () => {
    const storageId = "listener-isolation", database = new LocalDatabase({storageId, backend: new LocalBackend({storageId})});
    await database.read(["posts"]);
    const original = new Error("callback failed"), failure = new Error("handler failed");
    const onError = vi.fn(() => { throw failure; }), healthy = vi.fn();
    keep(database.addEventListener(["posts"], {
        onChange: value => { if (value !== undefined) throw original; }, onError
    }));
    keep(database.addEventListener(["posts"], {onChange: healthy}));
    await vi.waitFor(() => expect(healthy).toHaveBeenCalledTimes(1));
    expect(await database.create(["posts", {post_id: "p1"}], {text: "A"})).toBe("p1");
    expect(healthy).toHaveBeenLastCalledWith({p1: {text: "A"}});
    expect(onError).toHaveBeenCalledOnce();
    expect(globalThis.reportError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual({text: "A"});
});

it("uses an uncaught microtask when the host has no reportError", async () => {
    vi.stubGlobal("reportError", undefined);
    const tasks = [];
    vi.stubGlobal("queueMicrotask", vi.fn(task => tasks.push(task)));
    const failure = new Error("unhandled listener failure");
    keep(addEventListener("listener-microtask", ["posts"], {onChange: () => { throw failure; }}, async () => ({})));
    await vi.waitFor(() => expect(tasks).toHaveLength(1));
    expect(() => tasks[0]()).toThrow(failure);
});

it("releases idle queues for every storageId, including after failed delivery", async () => {
    const set = vi.spyOn(Map.prototype, "set");
    for (const index of [1, 2, 3]) {
        const storageId = `listener-release-${index}`;
        keep(addEventListener(storageId, ["posts"], {onChange: () => {
            if (index === 2) throw new Error("delivery failed");
        }}, async () => ({})));
        const queues = queueFor(set, storageId);
        await vi.waitFor(() => expect(queues.has(storageId)).toBe(false));
    }
    expect(globalThis.reportError).toHaveBeenCalledOnce();
});

it("preserves queue ordering across unsubscribe/resubscribe while reads are pending", async () => {
    const storageId = "listener-resubscribe", first = deferred(), second = deferred();
    const set = vi.spyOn(Map.prototype, "set");
    const oldChange = vi.fn(), newChange = vi.fn();
    const oldRead = vi.fn(() => first.promise), newRead = vi.fn(() => second.promise);
    const old = keep(addEventListener(storageId, ["posts"], {onChange: oldChange}, oldRead));
    await vi.waitFor(() => expect(oldRead).toHaveBeenCalledOnce());
    const queues = queueFor(set, storageId);
    old.remove();
    keep(addEventListener(storageId, ["posts"], {onChange: newChange}, newRead));
    const currentTail = queues.get(storageId);
    expect(newRead).not.toHaveBeenCalled();
    first.resolve({old: true});
    await vi.waitFor(() => expect(newRead).toHaveBeenCalledOnce());
    expect(oldChange).not.toHaveBeenCalled();
    expect(queues.get(storageId)).toBe(currentTail);
    second.resolve({fresh: true});
    await vi.waitFor(() => expect(queues.has(storageId)).toBe(false));
    expect(newChange).toHaveBeenCalledExactlyOnceWith({fresh: true});
    expect(globalThis.reportError).not.toHaveBeenCalled();
});
