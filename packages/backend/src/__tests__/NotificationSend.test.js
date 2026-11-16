import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import sendFirebaseNotification from "../firebase-server/src/notification/send";
import {subscribeToken, deleteToken} from "../../../messaging/src/local/database";
import {messageType} from "../../../messaging/src/local/common";

const {messaging} = vi.hoisted(() => ({messaging: {sendEachForMulticast: vi.fn()}}));
vi.mock("../firebase-server/src/common/firebase", () => ({database: {}, messaging}));
beforeEach(() => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "false");
    vi.stubGlobal("indexedDB", new IDBFactory());
    messaging.sendEachForMulticast.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup(storageId = "first") {
    const backend = new LocalBackend({storageId, projectTitle: "App", projectUrl: "https://local.test"});
    const database = new LocalDatabase({storageId});
    database.setBackend(backend);
    backend.setDatabase(database);
    await database.read(["users_private"]);
    return {backend, database};
}
const devicesPath = ["users_private", {user_id: "recipient"}, {device: "device"}];
const payload = {userId: "recipient", data: {body: "hi"}, options: {priority: "high"}};
const defaults = {icon: "https://local.test/logo-192.png", title: "App"};

it("batches Firebase user devices, stringifies data and preserves per-token errors", async () => {
    const error = {code: "messaging/registration-token-not-registered", toJSON: () => ({code: "expired"})};
    messaging.sendEachForMulticast.mockImplementation(async ({tokens}) => ({responses: tokens.map(token =>
        token === "0" ? {error} : {messageId: token})}));
    const backend = {projectTitle: "App", projectUrl: "https://custom.test", request: vi.fn().mockResolvedValue(
        Object.fromEntries(Array.from({length: 501}, (_, i) => [i, {notification: String(i)}])))};
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendFirebaseNotification.call(backend, {userId: "recipient", data: {body: "hi", count: 2, absent: null}, options: {priority: "high"}});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.read", ["users_private", {user_id: "recipient"}, "device"]);
    expect(messaging.sendEachForMulticast.mock.calls.map(([arg]) => arg.tokens.length)).toEqual([500, 1]);
    expect(messaging.sendEachForMulticast.mock.calls[0][0]).toMatchObject({data: {body: "hi", count: "2", title: "App", icon: "https://custom.test/logo-192.png"},
        android: {priority: "high"}, webpush: {headers: {Urgency: "high"}}});
    expect(info.mock.calls[0][1].results[0]).toEqual({token: "0", expired: true, error: {code: "expired"}});
    expect(info.mock.calls[0][1].results[500]).toEqual({token: "500", messageId: "500"});
});
it("simulates Firebase emulator delivery without contacting FCM", async () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "true");
    const backend = {request: vi.fn().mockResolvedValue({one: {notification: "token"}})};
    await sendFirebaseNotification.call(backend, payload);
    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
});

it("only posts matching subscribed Local tokens within their storage", async () => {
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    const {backend} = await setup();
    const token = await subscribeToken("first");
    await backend.request("database.update", devicesPath, {one: {notification: "wrong"}, two: {notification: token}});
    const results = await backend.request("notification.send", payload);
    expect(results).toEqual([
        {token: "wrong", error: {code: "messaging/registration-token-not-registered"}, expired: true},
        {token, messageId: `local-${token}`},
    ]);
    expect(post).toHaveBeenCalledExactlyOnceWith({type: messageType, storageId: "first", message: {...defaults, body: "hi"}}, window.location.origin);
    post.mockClear();
    const {backend: second} = await setup("second");
    await second.request("database.update", devicesPath, {one: {notification: token}});
    await second.request("notification.send", payload);
    await deleteToken("first");
    expect(await backend.request("notification.send", payload)).toEqual([
        {token: "wrong", error: {code: "messaging/registration-token-not-registered"}, expired: true},
        {token, error: {code: "messaging/registration-token-not-registered"}, expired: true},
    ]);
    expect(post).not.toHaveBeenCalled();
    expect(await backend.request("database.read", devicesPath)).toEqual({one: {notification: "wrong"}, two: {notification: token}});
});
it.each([undefined, {}, {one: {}, two: {notification: ""}}])("skips missing device tokens %j", async devices => {
    const {backend} = await setup();
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    if (devices) await backend.request("database.update", devicesPath, devices);
    expect(await backend.request("notification.send", payload)).toEqual([]);
    expect(post).not.toHaveBeenCalled();
});
it("allows message metadata overrides and preserves data", async () => {
    const {backend} = await setup();
    const token = await subscribeToken("first");
    await backend.request("database.update", devicesPath, {one: {notification: token}});
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    const data = {title: "Custom", icon: "/custom.png", body: "Hello", count: 2};
    await backend.request("notification.send", {userId: "recipient", data});
    expect(post.mock.calls[0][0].message).toEqual(data);
});
it.each([undefined, null, [], ["legacy-token"], "recipient", {}, {userId: ""}, {userId: "  "}])("rejects invalid input before database access %j", async input => {
    const {backend} = await setup();
    const request = vi.spyOn(backend, "request");
    await expect(backend.request("notification.send", input)).rejects.toMatchObject({code: "backend/invalid-argument"});
    expect(request).toHaveBeenCalledTimes(1);
});
it("propagates device lookup failures", async () => {
    const {backend} = await setup();
    const request = backend.request.bind(backend);
    const error = new Error("read failed");
    vi.spyOn(backend, "request").mockImplementation((name, ...args) => name === "database.read"
        ? Promise.reject(error) : request(name, ...args));
    await expect(backend.request("notification.send", payload)).rejects.toBe(error);
});
it("delivers an alert created through the real LocalBackend", async () => {
    const {backend} = await setup();
    const token = await subscribeToken("first");
    await backend.request("database.update", devicesPath, {one: {notification: token}});
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    await backend.request("database.create", ["alerts", {user_id: "recipient"}, {alert_id: "alert"}], {uid: "author", type: "like"});
    await vi.waitFor(() => expect(post).toHaveBeenCalledExactlyOnceWith({type: messageType, storageId: "first",
        message: {...defaults, body: "Somebody liked your post", tag: "https://local.test/alerts/", type: "alert"}}, window.location.origin));
});
