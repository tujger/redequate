import {vi} from "vitest";
import ChatMeta from "../../chat/ChatMeta";

it("watches online state under the current chat and member", () => {
    const remove = vi.fn();
    const database = {addEventListener: vi.fn(() => ({remove}))};
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});
    const onChange = vi.fn();
    chat.watchOnline({uid: "alice", onChange});
    expect(database.addEventListener).toHaveBeenCalledExactlyOnceWith(
        ["chats", {chat_id: "chat-1"}, {message_id: "!meta"}, "members", {user_id: "alice"}],
        {onChange: expect.any(Function)}
    );
    chat.unwatchOnline();
    expect(remove).toHaveBeenCalledOnce();
});

it("fetches only the latest message ordered by created", async () => {
    const newer = {created: 200, text: "newer"};
    const next = vi.fn().mockResolvedValue([{key: "a-newer", value: newer}]);
    const database = {read: vi.fn(), cursor: vi.fn(() => ({next}))};
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});
    await chat.fetch();
    expect(database.read).not.toHaveBeenCalled();
    expect(database.cursor).toHaveBeenCalledExactlyOnceWith(
        ["chats", {chat_id: "chat-1"}, "message_id"], {orderBy: "created", order: "desc"}
    );
    expect(next).toHaveBeenCalledExactlyOnceWith(1);
    expect(chat.lastMessage).toBe(newer);
    expect(chat.timestamp).toBe(200);
});

it("handles a chat with no messages", async () => {
    const database = {cursor: vi.fn(() => ({next: vi.fn().mockResolvedValue([])}))};
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});
    await chat.fetch();
    expect(chat.lastMessage).toEqual({});
    expect(chat.timestamp).toBeUndefined();
});

const watchModel = () => {
    const subscriptions = [];
    const database = {
        addEventListener: vi.fn((path, handlers) => {
            let active = true;
            const subscription = {
                path,
                handlers,
                emit: (event, value) => active && handlers[event]?.(value),
                remove: vi.fn(() => { active = false; }),
            };
            subscriptions.push(subscription);
            return subscription;
        })
    };
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});
    const changed = vi.fn();
    chat.watch(changed);
    return {database, subscriptions, chat, changed};
};

it("watches new messages, visits and member removal on their respective paths", () => {
    const {database, subscriptions, chat, changed} = watchModel();
    expect(database.addEventListener.mock.calls.map(([path]) => path)).toEqual([
        ["chats", {chat_id: "chat-1"}, "message_id"], ["chats", {chat_id: "chat-1"}, {message_id: "!meta"}, {members: "members"}],
    ]);
    expect(subscriptions[0].handlers).toEqual({onChildAdd: expect.any(Function), orderBy: "created"});
    const message = {created: 20, text: "newer"};
    subscriptions[0].emit("onChildAdd", {key: "b", value: message});
    expect(chat.lastMessage).toBe(message);
    expect(chat.timestamp).toBe(20);
    expect(changed).toHaveBeenLastCalledWith(message);
    subscriptions[1].emit("onChildChange", {key: "alice", value: 25});
    expect(changed).toHaveBeenLastCalledWith({uid: "alice", timestamp: 25, type: "visit"});
    subscriptions[1].emit("onChildRemove", {key: "alice", value: 30});
    expect(changed).toHaveBeenLastCalledWith({removed: true, timestamp: 30, type: "remove"});
    chat.unwatch();
});

it("removes both subscriptions and receives no events after unwatch", () => {
    const {subscriptions, chat, changed} = watchModel();
    chat.unwatch();
    chat.unwatch();
    expect(subscriptions.every(subscription => subscription.remove.mock.calls.length === 1)).toBe(true);
    subscriptions[0].emit("onChildAdd", {key: "late", value: {created: 30, text: "late"}});
    subscriptions[1].emit("onChildChange", {key: "alice", value: 40});
    expect(changed).not.toHaveBeenCalled();
});

it("does not notify twice for the same new-message delivery", () => {
    const {subscriptions, chat, changed} = watchModel();
    const message = {created: 10, text: "same"};
    subscriptions[0].emit("onChildAdd", {key: "a", value: message});
    subscriptions[0].emit("onChildAdd", {key: "a", value: {...message}});
    expect(changed).toHaveBeenCalledExactlyOnceWith(message);
    chat.unwatch();
});

it("creates metadata with a generated chat ID and a fixed metadata key", async () => {
    let finish;
    const database = {
        read: vi.fn(async path => path[0] === "users_public" ? {name: "Bob"} : undefined),
        cursor: vi.fn(() => ({next: vi.fn().mockResolvedValue([])})),
        create: vi.fn(async (_path, callback) => {
            expect(callback("generated-chat")).toEqual({members: {alice: 0, bob: 0}});
            await new Promise(resolve => { finish = resolve; });
            return "!meta";
        })
    };
    const result = ChatMeta(database).fetchFor("alice", "bob");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(database.create).toHaveBeenCalledExactlyOnceWith(
        ["chats", "chat_id", {message_id: "!meta"}], expect.any(Function));
    finish();
    expect(await result).toEqual([expect.objectContaining({key: "generated-chat", redirect: true,
        meta: {members: {alice: 0, bob: 0}}})]);
});

it("propagates metadata creation failure without returning a new chat", async () => {
    const failure = new Error("write failed");
    const database = {
        read: vi.fn(async path => path[0] === "users_public" ? {name: "Bob"} : undefined),
        cursor: vi.fn(() => ({next: vi.fn().mockResolvedValue([])})),
        create: vi.fn(async (_path, callback) => { callback("unsaved-chat"); throw failure; })
    };
    await expect(ChatMeta(database).fetchFor("alice", "bob")).rejects.toBe(failure);
});

it("creates missing participant indexes when updating an already saved chat", async () => {
    const database = {
        TIMESTAMP: "timestamp-marker",
        read: vi.fn(async path => path[0] === "chats"
            ? {members: {alice: 0, bob: 0}}
            : path[1].user_id === "bob" ? {private: "alice", timestamp: 1} : undefined),
        cursor: vi.fn(() => ({next: vi.fn().mockResolvedValue([])})),
        update: vi.fn().mockResolvedValue(undefined)
    };
    const chat = await ChatMeta(database).fetch("new-chat");
    expect(chat.persisted).toBe(true);
    await chat.update();
    const changes = database.update.mock.calls.at(-1)[0];
    expect([...changes]).toEqual([
        [["_chats", {user_id: "alice"}, {chat_id: "new-chat"}, "private"], "bob"],
        [["_chats", {user_id: "alice"}, {chat_id: "new-chat"}, "timestamp"], database.TIMESTAMP],
        [["_chats", {user_id: "bob"}, {chat_id: "new-chat"}, "timestamp"], database.TIMESTAMP]
    ]);
});
