import {IDBFactory} from "fake-indexeddb";
import {sendToTokens} from "../firebase-server/src/notification/send";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import LocalBackend from "../local/LocalBackend";
import {subscribeToken, deleteToken} from "../../../messaging/src/local/database";
import {messageType} from "../../../messaging/src/local/common";

beforeEach(() => { vi.stubEnv("FUNCTIONS_EMULATOR", "false"); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("batches tokens, stringifies data and preserves per-token errors", async () => {
    const error = {code: "messaging/registration-token-not-registered", toJSON: () => ({code: "expired"})};
    const messaging = {sendEachForMulticast: vi.fn(async ({tokens}) => ({responses: tokens.map(token =>
        token === "0" ? {error} : {messageId: token})}))};
    const tokens = Array.from({length: 501}, (_, i) => String(i));
    const results = await sendToTokens(messaging, tokens, {data: {body: "hi", count: 2, absent: null}}, {priority: "high"});
    expect(messaging.sendEachForMulticast.mock.calls.map(([arg]) => arg.tokens.length)).toEqual([500, 1]);
    expect(messaging.sendEachForMulticast.mock.calls[0][0]).toMatchObject({data: {body: "hi", count: "2"},
        android: {priority: "high"}, webpush: {headers: {Urgency: "high"}}});
    expect(results[0]).toEqual({token: "0", expired: true, error: {code: "expired"}});
    expect(results[500]).toEqual({token: "500", messageId: "500"});
});
it("simulates emulator delivery without contacting FCM", async () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "true");
    const messaging = {sendEachForMulticast: vi.fn()};
    expect(await sendToTokens(messaging, ["token"], {data: {}})).toEqual([{token: "token", messageId: "emulator-0"}]);
    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
});
it("dispatches internal Firebase notifications with configured metadata", async () => {
    const messaging = {sendEachForMulticast: vi.fn().mockResolvedValue({responses: [{messageId: "sent"}]})};
    const backend = new FirebaseServerBackend(() => ({app: {options: {projectId: "demo-test"}}}), undefined,
        {projectTitle: "App", projectUrl: "https://custom.test", getMessagingInstance: () => messaging});
    expect(backend.projectTitle).toBe("App"); expect(backend.projectUrl).toBe("https://custom.test");
    expect(await backend.request("notification.send", ["t"], {data: {body: "hi"}})).toEqual([{token: "t", messageId: "sent"}]);
    expect(new FirebaseServerBackend(() => ({app: {options: {projectId: "demo-test"}}})).projectUrl).toBe("https://demo-test.web.app");
});
it("only posts matching subscribed Local tokens within their storage", async () => {
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    const token = await subscribeToken("first");
    const backend = new LocalBackend({storageId: "first", projectTitle: "App", projectUrl: "https://local.test"});
    expect(backend.projectTitle).toBe("App"); expect(backend.projectUrl).toBe("https://local.test");
    await backend.request("notification.send", ["wrong", token], {data: {body: "hi"}});
    expect(post).toHaveBeenCalledExactlyOnceWith({type: messageType, storageId: "first", message: {body: "hi"}}, window.location.origin);
    post.mockClear();
    await new LocalBackend({storageId: "second"}).request("notification.send", [token], {data: {}});
    await deleteToken("first");
    await backend.request("notification.send", [token], {data: {}});
    expect(post).not.toHaveBeenCalled();
});
