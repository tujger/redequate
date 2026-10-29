import React, {act} from "react";
import {vi} from "vitest";
import Dispatcher from "../Dispatcher";
import UserData from "../controllers/UserData";
import {useMetaInfo} from "../controllers/General";
import {refreshAll} from "../controllers/Store";
import textTranslation from "../controllers/textTranslation";
import loadUserData from "../../packages/auth/src/common/loadUserData";
import {render, unmount} from "./render";

const context = vi.hoisted(() => ({setUser: vi.fn(), meta: undefined}));
vi.mock("notistack", () => ({SnackbarProvider: () => null}));
vi.mock("react-ios-pwa-prompt", () => ({default: () => null}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value}), getI18n: () => undefined}));
vi.mock("../controllers", () => ({useDatabase: vi.fn()}));
vi.mock("../controllers/AppContext/AppContext", () => ({default: () => React.createElement("div", null, "Initialized")}));
vi.mock("../controllers/General", () => ({
    cacheDatas: {put: vi.fn()},
    fetchDeviceId: () => "device",
    Layout: {},
    useMetaInfo: vi.fn(initial => {
        if (initial instanceof Function) context.meta = initial(context.meta);
        else if (initial) context.meta = initial;
        return context.meta;
    }),
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
    vi.clearAllMocks();
    context.meta = undefined;
    vi.spyOn(globalThis, "setInterval").mockReturnValue(0);
});
afterEach(() => unmount(container));

const start = async (resolveUser, values = {}) => {
    const database = {
        read: vi.fn(async path => values[path.map(segment => typeof segment === "string" ? segment : Object.values(segment)[0]).join("/")]),
        addEventListener: vi.fn(() => ({remove: vi.fn()})),
        create: vi.fn().mockResolvedValue("error-key"),
        TIMESTAMP: {".sv": "timestamp"},
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


it("updates settings without repeating initialization", async () => {
    const resolveUser = vi.fn(() => new UserData());
    const database = await start(resolveUser);
    const {onChange} = database.addEventListener.mock.calls[0][1];
    await act(async () => onChange({settings: {title: "Initial"}}));
    for (const title of ["First save", "Second save"]) {
        await act(async () => onChange({settings: {title}}));
        expect(useMetaInfo).toHaveBeenLastCalledWith({settings: {title}});
    }
    expect(resolveUser).toHaveBeenCalledTimes(1);
    expect(database.read).toHaveBeenCalledTimes(1);
    expect(database.addEventListener).toHaveBeenCalledTimes(1);
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(refreshAll).toHaveBeenCalledTimes(2);
});

it("initializes translation with the loaded settings", async () => {
    context.meta = {settings: {firebaseApiKey: "stale-key"}};
    await start(() => new UserData(), {"meta/settings": {firebaseApiKey: "loaded-key"}});
    expect(textTranslation).toHaveBeenCalledExactlyOnceWith({firebaseApiKey: "loaded-key"});
});


it("saves all console error arguments with nested Error details", async () => {
    const original = vi.spyOn(console, "error").mockImplementation(() => {});
    const database = await start(() => new UserData());
    const cause = new Error("root cause");
    const error = Object.assign(new Error("failed", {cause}), {code: "backend/failed", details: {retry: false}});
    console.error("Request failed", {error, count: 2});
    expect(original).toHaveBeenCalledWith("Request failed", {error, count: 2});
    const [path, saved] = database.create.mock.calls[0];
    expect(path).toEqual(["errors", "error_id"]);
    expect(saved).toMatchObject({uid: "anonymous", timestamp: database.TIMESTAMP});
    expect(typeof saved.error).toBe("string");
    expect(saved.error.startsWith("Request failed\n")).toBe(true);
    const details = JSON.parse(saved.error.slice("Request failed\n".length));
    expect(details).toMatchObject({count: 2, error: {name: "Error", message: "failed", stack: error.stack,
        code: "backend/failed", details: {retry: false}, cause: {message: "root cause", stack: cause.stack}}});
});

it("keeps readable data alongside cycles, BigInt, undefined and throwing getters", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const database = await start(() => new UserData());
    const details = {count: 12n, missing: undefined}; details.self = details;
    Object.defineProperty(details, "broken", {enumerable: true, get() { throw new Error("getter failed"); }});
    console.error(details, undefined);
    const text = database.create.mock.calls[0][1].error;
    expect(text).toContain('"count": "12n"');
    expect(text).toContain('"self": "[Circular]"');
    expect(text).toContain('"missing": "[undefined]"');
    expect(text).toContain('"broken": "[Unreadable property]"');
    expect(text.endsWith('\n"[undefined]"')).toBe(true);
});

it("saves a single string unchanged and filters messages across arguments", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const database = await start(() => new UserData());
    console.error("plain error");
    expect(database.create.mock.calls[0][1].error).toBe("plain error");
    database.create.mockClear();
    console.error();
    for (const filter of ["Module not found", "no such file or directory", "memory access out of bounds"]) {
        console.error("context", {message: filter});
    }
    expect(database.create).not.toHaveBeenCalled();
});

it("reports save rejection through the original console without recursive writes", async () => {
    const original = vi.spyOn(console, "error").mockImplementation(() => {});
    const database = await start(() => new UserData());
    const failure = new Error("save failed");
    database.create.mockRejectedValueOnce(failure);
    console.error("original error");
    await Promise.resolve();
    expect(database.create).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(failure);
});

it("reports synchronous save failure and restores the console on unmount", async () => {
    const original = vi.spyOn(console, "error").mockImplementation(() => {});
    const database = await start(() => new UserData());
    const failure = new Error("save failed");
    database.create.mockImplementationOnce(() => { throw failure; });
    console.error(new Error("original error"));
    expect(database.create).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(failure);
    unmount(container);
    expect(console.error).toBe(original);
});
