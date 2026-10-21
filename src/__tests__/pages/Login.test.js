/* eslint react/jsx-uses-vars: "error", react/jsx-uses-react: "error" */
import React, {act} from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";

const fixture = vi.hoisted(() => ({
    deviceId: "8e5604af-99db-47a5-b5e9-465040486690",
    userId: "login-user",
    dispatch: vi.fn(),
    refresh: vi.fn(),
    notify: vi.fn(),
    changeLanguage: vi.fn(),
    history: {push: vi.fn(), replace: vi.fn(), goBack: vi.fn()},
    location: {pathname: "/login", state: null},
    pages: {
        login: {route: "/login"},
        profile: {route: "/profile"},
        editprofile: {route: "/edit-profile"},
        home: {route: "/home"},
    },
}));

vi.mock("../../controllers", async () => ({
    useAuth: (await import("../../controllers/AppContext/useAuth")).default,
    useDatabase: (await import("../../controllers/AppContext/useDatabase")).default,
    useMessaging: (await import("../../controllers/AppContext/useMessaging")).default,
}));
vi.mock("../../controllers/General", () => ({
    fetchDeviceId: () => fixture.deviceId,
    usePages: () => fixture.pages,
    useStore: () => fixture.dispatch,
    useMetaInfo: () => ({}),
    cacheDatas: {remove: vi.fn(), put: vi.fn()},
}));
vi.mock("../../controllers/Store", () => ({refreshAll: fixture.refresh}));
vi.mock("../../controllers/notifySnackbar", () => ({default: fixture.notify}));
vi.mock("../../controllers/Notifications", () => ({setupReceivingNotifications: messaging => messaging.subscribe()}));
vi.mock("react-redux", () => ({useDispatch: () => fixture.dispatch}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: value => value, i18n: {changeLanguage: fixture.changeLanguage}}),
    getI18n: () => ({changeLanguage: fixture.changeLanguage}),
}));
vi.mock("react-router-dom", () => ({
    useHistory: () => fixture.history,
    useLocation: () => fixture.location,
    withRouter: Component => Component,
    // eslint-disable-next-line react/prop-types -- Router UI substitute.
    Redirect: ({to}) => React.createElement("span", {"data-redirect": to}),
}));
vi.mock("react-device-detect", () => ({browserName: "Test", deviceType: "desktop", osName: "TestOS", osVersion: "1"}));
vi.mock("@mui/icons-material/Lock", () => ({default: () => null}));
vi.mock("@mui/icons-material/Mail", () => ({default: () => null}));
vi.mock("../../components/ConfirmComponent", () => ({default: () => null}));
vi.mock("../../components/LoadingComponent", () => ({default: () => null}));
vi.mock("../../components/PasswordField", () => ({default: () => null}));
vi.mock("../../components/ProgressView", () => ({default: {SHOW: "show-progress", HIDE: "hide-progress"}}));
vi.mock("../../controls/Button/Button", () => ({default: () => null}));
vi.mock("../../controls/TextField/TextField", () => ({default: () => null}));

let container;
beforeEach(() => {
    vi.clearAllMocks();
    fixture.location.state = null;
    fixture.changeLanguage.mockResolvedValue();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
});
afterEach(() => {
    unmount(container);
    container.remove();
});

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return {promise, resolve, reject};
};

async function mountLogin({ios = false, disabled = false, firstLogin = false, signedIn = false} = {}) {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ios ? "iPhone" : "Desktop");
    // The iOS flag is captured on import; keep shared Context modules intact.
    const [loginModule, contextModule, stateModule, userModule, currentModule] = await Promise.all([
        ios ? import("../../pages/Login?ios") : import("../../pages/Login"), import("../../controllers/AppContext/AppContext"),
        import("../../controllers/AppContext/AppState"), import("../../controllers/UserData"),
        import("../../controllers/useCurrentUserData"),
    ]);
    const {UserData, UserRole} = userModule;
    const {getCurrentUserData} = currentModule;
    const Login = loginModule.default;
    const AppContext = contextModule.default;
    const profile = {name: "Login User", email: "user@example.test", emailVerified: true, created: 1234, updated: 5678};
    const device = {osName: "ExistingOS", locale: "ru"};
    const authUser = new UserData().create(fixture.userId, profile);
    if (firstLogin) await authUser.setPrivate(fixture.deviceId, device);
    const auth = {signInWithEmailAndPassword: vi.fn().mockResolvedValue(authUser)};
    const events = [];
    const database = {
        TIMESTAMP: {".sv": "timestamp"},
        read: vi.fn(async path => {
            if (path[0] === "roles") return disabled ? UserRole.DISABLED : UserRole.USER;
            if (path[0] === "users_public" && path.length === 2) return firstLogin ? undefined : structuredClone(profile);
            if (path[0] === "users_private") return firstLogin ? undefined : structuredClone(device);
            return undefined;
        }),
        update: vi.fn(async updates => {
            const notification = [...updates].find(([path]) => path[0] === "users_private" && (path[3] === "notification" || path[3]?.notification === "notification"))?.[1];
            events.push({type: "save", notification});
        }),
        write: vi.fn().mockResolvedValue(),
    };
    const messaging = {subscribe: vi.fn().mockResolvedValue("notification-token")};
    const state = stateModule.createAppState(signedIn ? {currentUserData: authUser} : undefined);
    state.store("currentUserData").subscribe(() => events.push({type: "publish", user: getCurrentUserData(state)}));
    const onLogin = vi.fn();
    // eslint-disable-next-line react/prop-types -- Test UI exposes the real login handler.
    const Layout = ({onRequestLogin}) => <button onClick={onRequestLogin}>Sign in</button>;
    render(<AppContext state={state} value={{auth, database, messaging}}><Login layout={<Layout/>} onLogin={onLogin}/></AppContext>, container);
    return {auth, database, messaging, state, events, onLogin, getUser: () => getCurrentUserData(state), UserData};
}

async function login(context) {
    await act(async () => {
        container.querySelector("button").click();
        await vi.waitFor(() => expect(context.onLogin).toHaveBeenCalledTimes(1));
    });
}

it("saves the notification before publishing the real frozen model and preserves hook order", async () => {
    const errors = vi.spyOn(console, "error");
    const context = await mountLogin();
    await login(context);
    const user = context.getUser();
    expect(user).toBeInstanceOf(context.UserData);
    expect(user.private[fixture.deviceId].notification).toBe("notification-token");
    expect(Object.isFrozen(user.private[fixture.deviceId])).toBe(true);
    const notificationSave = context.events.findIndex(event => event.type === "save" && event.notification === "notification-token");
    const publication = context.events.findIndex(event => event.type === "publish");
    expect(notificationSave).toBeGreaterThanOrEqual(0);
    expect(publication).toBeGreaterThan(notificationSave);
    expect(context.events.filter(event => event.type === "publish")).toHaveLength(1);
    expect(context.messaging.subscribe).toHaveBeenCalledTimes(1);
    expect(context.auth.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-redirect]").getAttribute("data-redirect")).toBe("/profile");
    expect(fixture.history.replace).toHaveBeenCalledWith("/home");
    expect(fixture.notify).toHaveBeenCalledWith({title: "Login.Subscribed to notifications"});
    expect(errors).not.toHaveBeenCalled();
});

it("waits for notification setup and database acknowledgement before publication", async () => {
    const subscription = deferred();
    const saved = deferred();
    const context = await mountLogin();
    context.messaging.subscribe.mockReturnValue(subscription.promise);
    context.database.update.mockImplementation(async updates => {
        if ([...updates].some(([path]) => (path[3] === "notification" || path[3]?.notification === "notification"))) await saved.promise;
    });
    await act(async () => {
        container.querySelector("button").click();
        await vi.waitFor(() => expect(context.messaging.subscribe).toHaveBeenCalledTimes(1));
    });
    expect(context.getUser().id).toBeUndefined();
    expect(context.onLogin).not.toHaveBeenCalled();
    await act(async () => {
        subscription.resolve("delayed-token");
        await vi.waitFor(() => expect(context.database.update).toHaveBeenCalledTimes(2));
    });
    expect(context.getUser().id).toBeUndefined();
    await act(async () => {
        saved.resolve();
        await vi.waitFor(() => expect(context.onLogin).toHaveBeenCalledTimes(1));
    });
    expect(context.getUser().private[fixture.deviceId].notification).toBe("delayed-token");
});

it("continues login when notifications are denied", async () => {
    const context = await mountLogin();
    const denied = new Error("permission denied");
    context.messaging.subscribe.mockRejectedValue(denied);
    await login(context);
    expect(context.getUser().id).toBe(fixture.userId);
    expect(context.getUser().private[fixture.deviceId].notification).toBeUndefined();
    expect(fixture.notify).toHaveBeenCalledWith(denied);
    expect(fixture.history.replace).toHaveBeenCalledWith("/home");
});

it("publishes disabled users and redirects without subscribing", async () => {
    const context = await mountLogin({disabled: true});
    await act(async () => {
        container.querySelector("button").click();
        await vi.waitFor(() => expect(fixture.history.push).toHaveBeenCalledWith("/profile"));
    });
    expect(context.getUser().id).toBe(fixture.userId);
    expect(context.getUser().disabled).toBe(true);
    expect(Object.isFrozen(context.getUser())).toBe(true);
    expect(context.messaging.subscribe).not.toHaveBeenCalled();
    expect(fixture.refresh).toHaveBeenCalledTimes(1);
    expect(context.onLogin).not.toHaveBeenCalled();
    expect(fixture.history.replace).not.toHaveBeenCalled();
});

it("publishes iOS users without notification setup", async () => {
    const context = await mountLogin({ios: true});
    await login(context);
    expect(context.getUser().id).toBe(fixture.userId);
    expect(context.messaging.subscribe).not.toHaveBeenCalled();
    expect(context.database.update).toHaveBeenCalledTimes(1);
});

it("keeps first-login navigation after notification preparation and model publication", async () => {
    const context = await mountLogin({firstLogin: true});
    await login(context);
    expect(context.onLogin).toHaveBeenCalledWith(true);
    expect(fixture.history.replace).toHaveBeenCalledWith("/edit-profile", {isFirstLogin: true});
    expect(context.getUser().private[fixture.deviceId].notification).toBe("notification-token");
});

it("does not restart authentication for an already signed-in user", async () => {
    fixture.location.state = {loginWith: "google"};
    const context = await mountLogin({signedIn: true});
    expect(context.auth.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(context.messaging.subscribe).not.toHaveBeenCalled();
    expect(fixture.dispatch).not.toHaveBeenCalled();
    expect(container.querySelector("[data-redirect]")).not.toBeNull();
});
