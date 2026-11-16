import {vi} from "vitest";
import UserData, {watchUserChanged} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";

vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
const setup = (subscription) => {
    const user = new UserData().create("one", {email: "one@example.test", updated: 1});
    const remove = vi.fn();
    const auth = {onAuthStateChanged: vi.fn(() => subscription ?? Promise.resolve(remove))};
    const database = {read: vi.fn().mockResolvedValue(1)};
    const controller = new AbortController();
    const onUserChanged = vi.fn();
    const refresh = watchUserChanged({auth, database, getUserData: () => user, onUserChanged, signal: controller.signal});
    return {user, auth, database, controller, remove, onUserChanged, refresh,
        notify: value => auth.onAuthStateChanged.mock.calls[0][0](value ?? user)};
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

it("keeps one auth subscription while polling and releases it on cancellation", async () => {
    const watcher = setup();
    await watcher.notify();
    await vi.advanceTimersByTimeAsync(180000);
    expect(watcher.auth.onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(watcher.database.read).toHaveBeenCalledTimes(7);
    watcher.controller.abort();
    expect(watcher.remove).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(watcher.database.read).toHaveBeenCalledTimes(7);
    expect(vi.getTimerCount()).toBe(0);
    const remounted = setup();
    await remounted.notify();
    remounted.controller.abort();
    expect(remounted.remove).toHaveBeenCalledTimes(1);
});

it("releases a subscription that finishes registration after cancellation", async () => {
    const registration = deferred();
    const watcher = setup(registration.promise);
    watcher.controller.abort();
    registration.resolve(watcher.remove);
    await Promise.resolve();
    expect(watcher.remove).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
});

it("does not subscribe when initialization reaches an already cancelled watcher", () => {
    const controller = new AbortController();
    controller.abort();
    const auth = {onAuthStateChanged: vi.fn()};
    watchUserChanged({auth, signal: controller.signal});
    expect(auth.onAuthStateChanged).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});

it("does not overlap checks or publish their results after cancellation", async () => {
    const watcher = setup();
    const read = deferred();
    watcher.database.read.mockReturnValue(read.promise);
    const pending = watcher.notify();
    await vi.advanceTimersByTimeAsync(90000);
    expect(watcher.database.read).toHaveBeenCalledTimes(1);
    watcher.controller.abort();
    read.resolve(2);
    await pending;
    await watcher.notify(new UserData());
    expect(notifySnackbar).not.toHaveBeenCalled();
    expect(watcher.onUserChanged).not.toHaveBeenCalled();
});

it("reports failed checks and continues polling", async () => {
    const watcher = setup();
    const failure = new Error("read failed");
    watcher.database.read.mockRejectedValueOnce(failure);
    await watcher.notify();
    expect(notifySnackbar).toHaveBeenCalledWith(failure);
    await vi.advanceTimersByTimeAsync(30000);
    expect(watcher.database.read).toHaveBeenCalledTimes(2);
    watcher.controller.abort();
});

it("refreshes the changed profile and resolves the existing promise contract", async () => {
    const watcher = setup();
    watcher.database.read.mockResolvedValue(2);
    await watcher.notify();
    const warning = notifySnackbar.mock.calls[0][0];
    expect(warning).toMatchObject({variant: "warning", buttonLabel: "Refresh"});
    vi.spyOn(UserData.prototype, "fetch").mockImplementation(async function () { return this; });
    await warning.onButtonClick();
    await watcher.refresh;
    expect(watcher.onUserChanged).toHaveBeenCalledTimes(1);
    watcher.controller.abort();
});

it("ignores a refresh that completes after cancellation", async () => {
    const watcher = setup();
    watcher.database.read.mockResolvedValue(2);
    await watcher.notify();
    const load = deferred();
    vi.spyOn(UserData.prototype, "fetch").mockReturnValue(load.promise);
    const pending = notifySnackbar.mock.calls[0][0].onButtonClick();
    watcher.controller.abort();
    load.resolve(watcher.user);
    await pending;
    expect(watcher.onUserChanged).not.toHaveBeenCalled();
});
