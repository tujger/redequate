import React, {act} from "react";
import {vi} from "vitest";
import Dispatcher from "../Dispatcher";
import UserData from "../controllers/UserData";
import loadUserData from "../../packages/auth/src/common/loadUserData";
import {render, unmount} from "./render";

const context = vi.hoisted(() => ({setUser: vi.fn()}));
vi.mock("notistack", () => ({SnackbarProvider: () => null}));
vi.mock("react-ios-pwa-prompt", () => ({default: () => null}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value}), getI18n: () => undefined}));
vi.mock("../controllers", () => ({useDatabase: vi.fn()}));
vi.mock("../controllers/AppContext/AppContext", () => ({default: () => React.createElement("div", null, "Initialized")}));
vi.mock("../controllers/Firebase", () => ({default: vi.fn()}));
vi.mock("../controllers/General", () => ({
    cacheDatas: {put: vi.fn()},
    fetchDeviceId: () => "device",
    Layout: {},
    useFirebase: vi.fn(),
    useMetaInfo: vi.fn(),
    useStore: vi.fn(),
    useWindowData: vi.fn(),
    usePages: value => value,
}));
vi.mock("../controllers/useCurrentUserData", () => ({
    useSetCurrentUserData: () => context.setUser, useCurrentUserDataValue: vi.fn(), getCurrentUserData: vi.fn(),
}));
vi.mock("../controllers/UserData", async importOriginal => ({
    ...await importOriginal(), watchUserChanged: () => new Promise(() => {}),
}));
vi.mock("../controllers/Store", () => ({default: () => ({}), refreshAll: vi.fn()}));
vi.mock("../controllers/textTranslation", () => ({default: vi.fn(), useTextTranslation: vi.fn()}));
vi.mock("../controllers/Notifications", () => ({setupReceivingNotifications: vi.fn()}));
vi.mock("../controllers/ServiceWorkerControl", () => ({checkForUpdate: vi.fn()}));
vi.mock("../controllers/WrapperControl", () => ({installWrapperControl: vi.fn()}));
vi.mock("../helpers/initInternationalization", () => ({default: async () => ({t: value => value, i18n: {changeLanguage: vi.fn()}})}));
vi.mock("../helpers/useBreakpoint", () => ({default: () => "md"}));
vi.mock("../reducers/languageReducer", () => ({restoreLanguage: vi.fn()}));

let container;
beforeEach(() => {
    container = document.createElement("div");
    context.setUser.mockClear();
    vi.spyOn(globalThis, "setInterval").mockReturnValue(0);
});
afterEach(() => unmount(container));

const start = async (resolveUser, values = {}) => {
    const database = {
        read: vi.fn(async path => values[path.map(segment => typeof segment === "string" ? segment : Object.values(segment)[0]).join("/")]),
        addEventListener: () => ({remove: vi.fn()}),
    };
    await act(async () => {
        render(
            <Dispatcher
                auth={{resolveCurrentUser: () => resolveUser(database)}} database={database}
                firebase={{}} backend={{}} messaging={{checkIfSubscribed: async () => false}} storage={{}}
                title="Startup test" pages={() => ({})} menu={() => []}
            />,
            container
        );
    });
    expect(container.textContent).toBe("Initialized");
    return database;
};

it("refreshes the authenticated profile and publishes the restored device data", async () => {
    const database = await start(database => loadUserData(new UserData(database).create("u1", {email: "user@example.test"}), database), {
        "users_public/u1": {email: "user@example.test", name: "Fresh profile"},
        "roles/u1": "admin",
        "users_private/u1": {device: {locale: "old"}},
        "users_private/u1/device": {locale: "en"},
    });
    expect(database.read.mock.calls.map(([path]) => path)).toEqual([
        ["users_public", {user_id: "u1"}], ["roles", {user_id: "u1"}],
        ["users_private", {user_id: "u1"}], ["meta", {settings: "settings"}],
        ["users_public", {user_id: "u1"}], ["roles", {user_id: "u1"}],
        ["users_private", {user_id: "u1"}, {device_id: "device"}],
    ]);
    expect(context.setUser).toHaveBeenCalledWith(expect.objectContaining({name: "Fresh profile", role: "admin", persisted: true, private: {device: {locale: "en"}}}));
});

it.each([
    {public: true, private: true},
    {public: true, role: true},
    {},
])("refreshes provider sections regardless of previously loaded flags %j", async loaded => {
    const database = await start(() => new UserData().fromJSON({
        id: "u1", public: {email: "user@example.test", name: "Stale name"}, private: {}, loaded,
    }), {
        "users_public/u1": {email: "user@example.test", name: "Fresh name"},
        "roles/u1": "admin",
        "users_private/u1/device": {locale: "en"},
    });
    expect(database.read.mock.calls.map(([path]) => path)).toEqual([
        ["meta", {settings: "settings"}],
        ["users_public", {user_id: "u1"}], ["roles", {user_id: "u1"}],
        ["users_private", {user_id: "u1"}, {device_id: "device"}],
    ]);
    expect(context.setUser).toHaveBeenCalledWith(expect.objectContaining({
        id: "u1", name: "Fresh name", role: "admin", private: {device: {locale: "en"}},
    }));
});

it("initializes a guest without profile reads", async () => {
    const guest = new UserData();
    const database = await start(() => guest);
    expect(database.read).toHaveBeenCalledExactlyOnceWith(["meta", {settings: "settings"}]);
    expect(context.setUser).toHaveBeenCalledWith(guest);
});
