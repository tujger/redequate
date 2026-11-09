import {IDBFactory} from "fake-indexeddb";
import {readNativeStore} from "../../../database/src/__tests__/createLocalDatabase";
import LocalDatabase from "../../../database/src/local";
import LocalBackend from "../local/LocalBackend";
import ChatListener from "../common/handlers/chats";

// Install the real chat reaction; isolate unrelated handlers and notification delivery.
vi.mock("../common", async () => ({handlers: {chats: (await import("../common/handlers/chats")).default}}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("creates metadata with the real Local chat handler without unidentified user reads", async () => {
    const reaction = vi.spyOn(ChatListener.prototype, "onCreate");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const backend = new LocalBackend({storageId: "local-chat-metadata"});
    const database = new LocalDatabase({storageId: "local-chat-metadata"});
    database.setBackend(backend);
    backend.setDatabase(database);
    await database.read(["chats"]);
    const request = vi.spyOn(backend, "request");
    let chatId;
    await database.create(["chats", "chat_id", {message_id: "!meta"}], key => {
        chatId = key;
        return {members: {alice: 0, bob: 0}};
    });
    await vi.waitFor(() => expect(reaction).toHaveBeenCalledExactlyOnceWith({
        params: {chat_id: chatId, message_id: "!meta"}, value: {members: {alice: 0, bob: 0}}
    }));
    expect(request.mock.calls.map(([name]) => name)).toEqual(["database.create"]);
    expect(errors).not.toHaveBeenCalled();
    expect(await readNativeStore(database.storageId, "chats")).toEqual([
        expect.objectContaining({chat_id: chatId, message_id: "!meta", members: {alice: 0, bob: 0}})
    ]);
});
