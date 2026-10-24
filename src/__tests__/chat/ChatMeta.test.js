import {vi} from "vitest";
import ChatMeta from "../../chat/ChatMeta";

vi.mock("../../controllers/Firebase", () => ({
    firebaseMessaging: {database: () => ({ref: () => ({})})}
}));

it("watches online state under the current chat and member", () => {
    const remove = vi.fn();
    const database = {addEventListener: vi.fn(() => ({remove}))};
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});
    const onChange = vi.fn();
    chat.watchOnline({uid: "alice", onChange});
    expect(database.addEventListener).toHaveBeenCalledExactlyOnceWith(
        ["chats", {chat_id: "chat-1"}, "!meta", "members", {user_id: "alice"}],
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
        ["chats", {chat_id: "chat-1"}], ["chats", {chat_id: "chat-1"}, "!meta", "members"],
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
