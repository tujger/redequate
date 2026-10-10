import {vi} from "vitest";
import FirebaseMessaging from "../firebase";
let firebase, sdk, messaging;
beforeEach(() => {
    window.localStorage.clear();
    sdk = {getToken: vi.fn().mockResolvedValue("token"), deleteToken: vi.fn().mockResolvedValue(true), onMessage: vi.fn()};
    firebase = {messaging: Object.assign(vi.fn(() => sdk), {isSupported: vi.fn(() => true)})};
    vi.stubGlobal("Notification", {requestPermission: vi.fn().mockResolvedValue("granted")});
    messaging = new FirebaseMessaging({firebase});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); });
it("checks saved state without creating SDK instances, prompting or writing", async () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(await messaging.checkIfSubscribed()).toBe(false);
    expect(firebase.messaging).not.toHaveBeenCalled();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
});
it("persists successful subscription and removes it on successful deletion", async () => {
    expect(await messaging.subscribe()).toBe("token");
    expect(window.localStorage.getItem("notification-token")).toBe("token");
    expect(await new FirebaseMessaging({firebase}).checkIfSubscribed()).toBe(true);
    expect(await messaging.unsubscribe()).toBe(true);
    expect(await messaging.checkIfSubscribed()).toBe(false);
});
it("keeps saved state on SDK errors and isolates configured keys", async () => {
    await messaging.subscribe();
    const error = new Error("SDK failed");
    sdk.getToken.mockRejectedValue(error);
    sdk.deleteToken.mockRejectedValue(error);
    await expect(messaging.subscribe()).rejects.toBe(error);
    await expect(messaging.unsubscribe()).rejects.toBe(error);
    expect(await messaging.checkIfSubscribed()).toBe(true);
    expect(await new FirebaseMessaging({firebase, storageKey: "other"}).checkIfSubscribed()).toBe(false);
});
it.each(["denied", "default"])("does not request a token when permission is %s", async permission => {
    window.Notification.requestPermission.mockResolvedValue(permission);
    await expect(messaging.subscribe()).rejects.toThrow("Notifications denied");
    expect(sdk.getToken).not.toHaveBeenCalled();
    expect(await messaging.checkIfSubscribed()).toBe(false);
});
it("checks support before constructing Messaging", async () => {
    firebase.messaging.isSupported.mockReturnValue(false);
    for (const operation of [() => messaging.subscribe(), () => messaging.unsubscribe(), () => messaging.addMessageListener(() => {})]) {
        await expect(operation()).rejects.toMatchObject({code: "messaging/unsupported-browser"});
    }
    expect(firebase.messaging).not.toHaveBeenCalled();
});
it("normalizes foreground messages and returns the SDK disposer", async () => {
    const stop = vi.fn(); let notify;
    sdk.onMessage.mockImplementation(callback => { notify = callback; return stop; });
    const onMessage = vi.fn();
    expect(await messaging.addMessageListener(onMessage)).toBe(stop);
    notify({notification: {body: "body", icon: "icon"}, data: {body: "ignored"}, from: "sender", priority: "high"});
    expect(onMessage).toHaveBeenLastCalledWith({body: "body", icon: "icon", image: "icon", from: "sender", priority: "high"});
    notify({data: {title: "data"}});
    expect(onMessage).toHaveBeenLastCalledWith({title: "data", image: undefined, from: undefined, priority: undefined});
    notify({});
    expect(onMessage).toHaveBeenLastCalledWith({image: undefined, from: undefined, priority: undefined});
    expect(sdk.getToken).not.toHaveBeenCalled();
});
it("validates callbacks and keys and passes storage errors through", async () => {
    await expect(messaging.addMessageListener(null)).rejects.toMatchObject({code: "messaging/invalid-argument"});
    for (const key of [null, "", " ", 1]) expect(() => new FirebaseMessaging({firebase, storageKey: key})).toThrow("storageKey");
    const error = new Error("blocked");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw error; });
    await expect(messaging.checkIfSubscribed()).rejects.toBe(error);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw error; });
    await expect(messaging.subscribe()).rejects.toBe(error);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw error; });
    await expect(messaging.unsubscribe()).rejects.toBe(error);
});
it("reports validation errors with complete codes and messages before using the SDK", async () => {
    await expect(messaging.addMessageListener("invalid")).rejects.toMatchObject({code: "messaging/invalid-argument", message: "Message listener must be a function."});
    try {
        expect(new FirebaseMessaging({firebase, storageKey: ""})).toBeDefined();
        throw new Error("Expected storage key failure");
    } catch (error) {
        expect(error).toMatchObject({code: "messaging/invalid-argument", message: "storageKey must be a non-empty string."});
    }
    expect(firebase.messaging).not.toHaveBeenCalled();
    expect(firebase.messaging.isSupported).not.toHaveBeenCalled();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    firebase.messaging.isSupported.mockReturnValue(false);
    await expect(messaging.subscribe()).rejects.toMatchObject({code: "messaging/unsupported-browser", message: "This browser doesn't support Firebase Messaging"});
    expect(firebase.messaging).not.toHaveBeenCalled();
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
});
