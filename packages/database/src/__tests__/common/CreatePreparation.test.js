import {getDatabase, ref, push} from "firebase/database";
import FirebaseDatabase from "../../firebase";
import LocalDatabase from "../../local";
import DatabaseBase from "../../common/DatabaseBase";

vi.mock("firebase/database", async importOriginal => ({
    ...await importOriginal(),
    getDatabase: vi.fn(app => ({app})),
    ref: vi.fn((database, path) => ({database, path})),
    push: vi.fn(() => ({key: "firebase-generated"}))
}));

beforeEach(() => vi.clearAllMocks());

const firebase = {app: {name: "test"}};
const databaseFor = (provider, backend, onError) => {
    const database = provider === "firebase"
        ? new FirebaseDatabase({firebase, onError})
        : new LocalDatabase({onError});
    database.setBackend(backend);
    return database;
};
const create = (provider, backend, path, value) => databaseFor(provider, backend).create(path, value);

it.each(["local", "firebase"])("%s passes its ready key in options to super and sends the prepared value", async provider => {
    const events = [];
    const preparedValue = {title: "ready"};
    const backend = {request: vi.fn(async () => { events.push("request"); return "saved-key"; })};
    const callback = vi.fn(key => {
        events.push("callback");
        expect(key).toBe("manual");
        return preparedValue;
    });
    const path = ["posts", {post_id: "manual"}];
    const database = databaseFor(provider, backend);
    const run = vi.spyOn(database, "run");
    const superCreate = vi.spyOn(DatabaseBase.prototype, "create");
    expect(await database.create(path, callback)).toBe("saved-key");
    expect(superCreate).toHaveBeenCalledWith(path, callback, expect.objectContaining({key: "manual"}));
    expect(superCreate.mock.calls[0][2]).not.toHaveProperty("backend");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["callback", "request"]);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", path, preparedValue);
    expect(run).toHaveBeenCalledExactlyOnceWith(expect.any(Function), undefined, "create", {path, value: callback});
    expect(push).not.toHaveBeenCalled();
});

it.each(["local", "firebase"])("%s supplies its generated final key to the common preparation", async provider => {
    const backend = {request: vi.fn(async (_name, path) => path.at(-1).id)};
    let callbackKey;
    const path = ["chats", {chat_id: "c1"}, {messages: "messages"}, "id"];
    const superCreate = vi.spyOn(DatabaseBase.prototype, "create");
    const callback = id => { callbackKey = id; return {id}; };
    const key = await create(provider, backend, path, callback);
    expect(key).toBe(callbackKey);
    expect(superCreate).toHaveBeenCalledWith(path, callback, expect.objectContaining({key}));
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create",
        ["chats", {chat_id: "c1"}, {messages: "messages"}, {id: key}], {id: key});
    if (provider === "firebase") {
        expect(key).toBe("firebase-generated");
        expect(getDatabase).toHaveBeenCalledExactlyOnceWith(firebase.app);
        expect(ref).toHaveBeenCalledWith({app: firebase.app}, "chats/c1/messages");
        expect(push).toHaveBeenCalledTimes(1);
    } else {
        expect(key).toMatch(/^[-0-9A-Z_a-z]{20}$/);
        expect(push).not.toHaveBeenCalled();
    }
});

it("Firebase leaves ordinary values without a key for its supplied backend", async () => {
    const path = ["posts", "post_id"];
    const value = {title: "ready"};
    const backend = {request: vi.fn().mockResolvedValue("backend-key")};
    const database = databaseFor("firebase", backend);
    expect(await database.create(path, value)).toBe("backend-key");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", path, value);
    expect(getDatabase).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
});

it("Local generates a key for an ordinary value before calling super", async () => {
    const value = {title: "ready"};
    const backend = {request: vi.fn(async (_name, path) => path.at(-1).post_id)};
    const key = await create("local", backend, ["posts", "post_id"], value);
    expect(key).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["posts", {post_id: key}], value);
});

it.each(["local", "firebase"])("%s rejects invalid values before requesting the backend", async provider => {
    const backend = {request: vi.fn()};
    const path = ["posts", {post_id: "manual"}];
    for (const value of [undefined, null, "value", 1, false, [], () => null, async () => ({})]) {
        await expect(create(provider, backend, path, value)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    const error = new Error("callback failed");
    await expect(create(provider, backend, path, () => { throw error; })).rejects.toBe(error);
    expect(backend.request).not.toHaveBeenCalled();
});

it.each(["local", "firebase"])("%s has no backend fallback", async provider => {
    await expect(create(provider, undefined, ["posts", {post_id: "manual"}], {})).rejects.toBeInstanceOf(TypeError);
    expect(getDatabase).not.toHaveBeenCalled();
});

it.each(["local", "firebase"])("%s can create again after a backend rejection", async provider => {
    const failure = new Error("offline");
    const backend = {request: vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce("saved-key")};
    const database = databaseFor(provider, backend);
    const path = ["posts", {post_id: "manual"}], value = {title: "ready"};
    await expect(database.create(path, value)).rejects.toBe(failure);
    expect(await database.create(path, value)).toBe("saved-key");
    expect(backend.request.mock.calls).toEqual([
        ["database.create", path, value], ["database.create", path, value]
    ]);
});

it("Firebase maps conflicts and propagates other backend errors", async () => {
    const backend = {request: vi.fn().mockRejectedValueOnce({code: "functions/already-exists"})};
    await expect(create("firebase", backend, ["posts", {post_id: "manual"}], {}))
        .rejects.toMatchObject({code: "database/conflict"});
    const error = new Error("unavailable");
    backend.request.mockRejectedValueOnce(error);
    await expect(create("firebase", backend, ["posts", {post_id: "manual"}], {})).rejects.toBe(error);
});

it("Firebase normalizes errors before reporting them once to onError", async () => {
    const backend = {request: vi.fn().mockRejectedValue({code: "functions/already-exists"})};
    const onError = vi.fn();
    const database = databaseFor("firebase", backend, onError);
    const path = ["posts", {post_id: "manual"}];
    const value = {};
    expect(await database.create(path, value)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "database/conflict"}), "create", {path, value});
});

it("reports key-generation and callback failures through a single outer boundary", async () => {
    const backend = {request: vi.fn()};
    const onError = vi.fn();
    const database = databaseFor("firebase", backend, onError);
    const path = ["posts", "post_id"];
    const keyError = new Error("key generation failed");
    push.mockImplementationOnce(() => { throw keyError; });
    const callback = vi.fn(() => ({}));
    expect(await database.create(path, callback)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(keyError, "create", {path, value: callback});
    expect(callback).not.toHaveBeenCalled();
    onError.mockClear();
    const callbackError = new Error("callback failed");
    const failedCallback = () => { throw callbackError; };
    expect(await database.create(path, failedCallback)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(callbackError, "create", {path, value: failedCallback});
    expect(backend.request).not.toHaveBeenCalled();
});

it("keeps the bare base method unimplemented without provider options", async () => {
    await expect(new DatabaseBase().create(["posts", "post_id"], {})).rejects.toThrow("Not implemented: create");
});

it("uses the backend supplied through setBackend", async () => {
    const backend = {request: vi.fn().mockResolvedValue("base-key")};
    const database = new DatabaseBase();
    database.setBackend(backend);
    const callback = vi.fn(key => ({key}));
    expect(await database.create(["posts", "post_id"], callback, {key: "prepared-key"})).toBe("base-key");
    expect(callback).toHaveBeenCalledExactlyOnceWith("prepared-key");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["posts", {post_id: "prepared-key"}], {key: "prepared-key"});
});

it.each(["local", "firebase"])("%s generates intermediate IDs for ordinary values without changing fixed segments", async provider => {
    const backend = {request: vi.fn(async (_name, path) => typeof path.at(-1) === "string" ? "server-key" : path.at(-1).message_id)};
    const path = ["chats", "chat_id", {branch: "fixed"}, "message_id"];
    const value = {text: "new"};
    const key = await create(provider, backend, path, value);
    const prepared = backend.request.mock.calls[0][1];
    expect(prepared[1]).toEqual({chat_id: expect.stringMatching(/^[-0-9A-Z_a-z]{20}$/)});
    expect(prepared[2]).toEqual({branch: "fixed"});
    expect(prepared[3]).toEqual(provider === "firebase" ? "message_id" : {message_id: key});
    expect(key).toBe(provider === "firebase" ? "server-key" : prepared[3].message_id);
    expect(backend.request.mock.calls[0][2]).toBe(value);
    expect(path).toEqual(["chats", "chat_id", {branch: "fixed"}, "message_id"]);
    expect(push).not.toHaveBeenCalled();
});

it.each(["local", "firebase"])("%s passes both generated IDs to callbacks in path order", async provider => {
    const backend = {request: vi.fn(async (_name, path) => path.at(-1).message_id)};
    const callback = vi.fn((chatId, messageId) => ({chatId, messageId}));
    const key = await create(provider, backend, ["chats", "chat_id", "message_id"], callback);
    const [chatId, messageId] = callback.mock.calls[0];
    expect(chatId).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(messageId).toBe(key);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create",
        ["chats", {chat_id: chatId}, {message_id: messageId}], {chatId, messageId});
});

it.each(["local", "firebase"])("%s generates only the chat ID when the metadata key is fixed", async provider => {
    const backend = {request: vi.fn(async (_name, path) => path.at(-1).message_id)};
    const callback = vi.fn(chatId => ({members: {alice: 0, bob: 0}}));
    expect(await create(provider, backend, ["chats", "chat_id", {message_id: "!meta"}], callback)).toBe("!meta");
    const [chatId] = callback.mock.calls[0];
    expect(chatId).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(callback).toHaveBeenCalledExactlyOnceWith(chatId);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create",
        ["chats", {chat_id: chatId}, {message_id: "!meta"}], {members: {alice: 0, bob: 0}});
    expect(push).not.toHaveBeenCalled();
});
