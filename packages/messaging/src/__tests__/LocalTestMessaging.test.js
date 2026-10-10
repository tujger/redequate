import {vi} from "vitest";
import LocalTestMessaging from "../local-test";
let messaging, disposers;
const clone = globalThis.structuredClone;
async function run(promise) {
    const pending = promise.then(value => ({value}), error => ({error}));
    await vi.runAllTimersAsync();
    const result = await pending;
    if (result.error) throw result.error;
    return result.value;
}
beforeEach(() => {
    window.localStorage.clear(); delete window.redequateMessaging;
    vi.stubGlobal("structuredClone", clone);
    vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "error").mockImplementation(() => {});
    messaging = new LocalTestMessaging(); disposers = [];
});
afterEach(() => {
    disposers.forEach(dispose => dispose());
    vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    window.localStorage.clear(); delete window.redequateMessaging;
});
const listen = async (instance, handler) => { const dispose = await run(instance.addMessageListener(handler)); disposers.push(dispose); return dispose; };
it("restores saved subscription across instances without subscribing again", async () => {
    expect(await messaging.checkIfSubscribed()).toBe(false);
    const token = await run(messaging.subscribe());
    expect(await run(messaging.subscribe())).toBe(token);
    const restored = new LocalTestMessaging();
    expect(await restored.checkIfSubscribed()).toBe(true);
    const handler = vi.fn(); await listen(restored, handler);
    window.redequateMessaging.send({title: "restored"});
    expect(handler).toHaveBeenCalledWith({title: "restored"});
    await run(restored.unsubscribe());
    expect(await messaging.checkIfSubscribed()).toBe(false);
    window.redequateMessaging.send({title: "disabled"});
    expect(handler).toHaveBeenCalledOnce();
    expect(await run(messaging.subscribe())).not.toBe(token);
});
it("isolates keys, clones messages independently and disposes listeners", async () => {
    const other = new LocalTestMessaging({storageKey: "other"});
    const first = vi.fn(message => { message.nested.value = 2; });
    const second = vi.fn(); const isolated = vi.fn();
    const stop = await listen(messaging, first); await listen(messaging, second); await listen(other, isolated);
    window.redequateMessaging.send({nested: {value: 1}});
    expect(first).not.toHaveBeenCalled();
    await run(messaging.subscribe()); await run(other.subscribe());
    const original = {nested: {value: 1}}; window.redequateMessaging.send(original);
    expect(second).toHaveBeenLastCalledWith({nested: {value: 1}}); expect(original.nested.value).toBe(1);
    expect(isolated).not.toHaveBeenCalled();
    window.redequateMessaging.send({title: "other"}, "other"); expect(isolated).toHaveBeenCalledOnce();
    stop(); stop(); window.redequateMessaging.send(original); expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledTimes(2);
});
it("isolates synchronous and asynchronous handler failures", async () => {
    await run(messaging.subscribe());
    const sync = new Error("sync");
    const asyncError = new Error("async");
    await listen(messaging, () => { throw sync; });
    await listen(messaging, async () => { throw asyncError; });
    const healthy = vi.fn(); await listen(messaging, healthy);
    window.redequateMessaging.send({title: "test"}); await Promise.resolve(); await Promise.resolve();
    expect(healthy).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith("[LocalTestMessaging] Message handler failed", sync);
    expect(console.error).toHaveBeenCalledWith("[LocalTestMessaging] Message handler failed", asyncError);
});
it("validates console inputs and callbacks and passes storage errors through", async () => {
    for (const message of [null, [], "message"]) expect(() => window.redequateMessaging.send(message)).toThrow("Message must");
    expect(() => window.redequateMessaging.send({}, "")).toThrow("storageKey");
    await expect(messaging.addMessageListener(null)).rejects.toMatchObject({code: "messaging/invalid-argument"});
    const error = new Error("blocked");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw error; });
    await expect(messaging.checkIfSubscribed()).rejects.toBe(error);
    await expect(run(messaging.subscribe())).rejects.toBe(error);
});
it("does not change subscription state when storage writes or deletion fail", async () => {
    const error = new Error("blocked storage");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw error; });
    await expect(run(messaging.subscribe())).rejects.toBe(error);
    expect(await messaging.checkIfSubscribed()).toBe(false);
    write.mockRestore();
    const token = await run(messaging.subscribe());
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw error; });
    await expect(run(messaging.unsubscribe())).rejects.toBe(error);
    expect(await messaging.checkIfSubscribed()).toBe(true);
    expect(window.localStorage.getItem(messaging.storageKey)).toBe(token);
});
it("reports invalid console and listener arguments with full codes and messages", async () => {
    await expect(messaging.addMessageListener(null)).rejects.toMatchObject({code: "messaging/invalid-argument", message: "Message listener must be a function."});
    for (const [message, key, expected] of [[null, undefined, "Message must be an object."], [{}, "", "storageKey must be a non-empty string."]]) {
        try {
            window.redequateMessaging.send(message, key);
            throw new Error("Expected argument failure");
        } catch (error) {
            expect(error).toMatchObject({code: "messaging/invalid-argument", message: expected});
        }
    }
});
