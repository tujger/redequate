import {vi} from "vitest";
import {initializeApp, deleteApp} from "firebase/app";
import {getAnalytics, isSupported} from "firebase/analytics";
import Firebase, {firebaseMessaging, forceFirebaseReinit} from "../../controllers/Firebase";

vi.mock("firebase/app", () => ({initializeApp: vi.fn(), deleteApp: vi.fn()}));
vi.mock("firebase/analytics", () => ({getAnalytics: vi.fn(), isSupported: vi.fn()}));

const config = {projectId: "demo-firebase"};
let app, reload;
beforeEach(() => {
    app = {name: "[DEFAULT]"};
    reload = vi.fn();
    vi.stubGlobal("window", {location: {reload}});
    initializeApp.mockReset().mockReturnValue(app);
    deleteApp.mockReset().mockResolvedValue();
    isSupported.mockReset().mockResolvedValue(false);
    getAnalytics.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

it("initializes a modular app and preserves the shared handle", () => {
    const handle = Firebase(config);
    expect(initializeApp).toHaveBeenCalledExactlyOnceWith(config);
    expect(handle).toBe(firebaseMessaging);
    expect(handle).toEqual({app, config});
    expect(handle).not.toHaveProperty("database");
    expect(Firebase(config)).toBe(handle);
    expect(isSupported).not.toHaveBeenCalled();
});

it.each([true, false])("initializes Analytics only when configured and supported: %s", async supported => {
    isSupported.mockResolvedValue(supported);
    Firebase({...config, measurementId: "test"});
    await Promise.resolve();
    if (supported) expect(getAnalytics).toHaveBeenCalledExactlyOnceWith(app);
    else expect(getAnalytics).not.toHaveBeenCalled();
});

it("waits for deletion before reinitializing the shared handle and reloading", async () => {
    const handle = Firebase(config);
    let finish;
    deleteApp.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const nextApp = {name: "[DEFAULT]", replacement: true};
    initializeApp.mockReturnValue(nextApp);
    const pending = forceFirebaseReinit();
    expect(deleteApp).toHaveBeenCalledExactlyOnceWith(app);
    expect(initializeApp).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    finish();
    expect(await pending).toBe(handle);
    expect(handle.app).toBe(nextApp);
    expect(initializeApp).toHaveBeenLastCalledWith(config);
    expect(reload).toHaveBeenCalledOnce();
});

it("propagates deletion errors without reinitializing or reloading", async () => {
    Firebase(config);
    const error = new Error("delete failed");
    deleteApp.mockRejectedValue(error);
    await expect(forceFirebaseReinit()).rejects.toBe(error);
    expect(initializeApp).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
});
