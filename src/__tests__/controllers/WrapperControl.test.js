import {vi} from "vitest";
import {getDatabase, goOffline, goOnline} from "firebase/database";
import {forceFirebaseReinit} from "../../controllers/Firebase";
import {installWrapperControl} from "../../controllers/WrapperControl";

vi.mock("firebase/database", () => ({getDatabase: vi.fn(), goOffline: vi.fn(), goOnline: vi.fn()}));
vi.mock("../../controllers/Firebase", () => ({forceFirebaseReinit: vi.fn()}));

beforeEach(() => {
    vi.stubGlobal("window", {WrapperControlInterface: {}});
    vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

it("reconnects the supplied app on the existing Android resume message", () => {
    const app = {};
    const database = {};
    getDatabase.mockReturnValue(database);
    installWrapperControl({app});
    window.wrapperControlCallback(JSON.stringify({id: "_on_resume"}));
    expect(getDatabase).toHaveBeenCalledExactlyOnceWith(app);
    expect(goOffline).toHaveBeenCalledExactlyOnceWith(database);
    expect(goOnline).toHaveBeenCalledExactlyOnceWith(database);
    expect(goOffline.mock.invocationCallOrder[0]).toBeLessThan(goOnline.mock.invocationCallOrder[0]);
});

it("retains reinitialization on the existing Android refresh message", () => {
    installWrapperControl({app: {}});
    window.wrapperControlCallback(JSON.stringify({id: "_on_refresh"}));
    expect(forceFirebaseReinit).toHaveBeenCalledOnce();
    expect(goOffline).not.toHaveBeenCalled();
});
