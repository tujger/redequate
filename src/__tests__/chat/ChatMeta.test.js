import {vi} from "vitest";
import {ChatMeta} from "../../chat/ChatMeta";

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

it("fetches only the latest message by created rather than key order", async () => {
    const messages = {
        "z-older": {created: 100, text: "older"},
        "a-newer": {created: 200, text: "newer"}
    };
    const next = vi.fn(async count => Object.entries(messages)
        .sort((a, b) => b[1].created - a[1].created)
        .slice(0, count)
        .map(([key, value]) => ({key, value})));
    const database = {
        read: vi.fn(),
        cursor: vi.fn(() => ({next}))
    };
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});

    await chat.fetch();

    expect(database.cursor).toHaveBeenCalledExactlyOnceWith(
        ["chats", {chat_id: "chat-1"}], {orderBy: "created", order: "desc"}
    );
    expect(next).toHaveBeenCalledExactlyOnceWith(1);
    expect(database.read).not.toHaveBeenCalled();
    expect(chat.lastMessage).toBe(messages["a-newer"]);
    expect(chat.timestamp).toBe(200);
});

it("handles a chat with no messages", async () => {
    const next = vi.fn(async () => []);
    const database = {read: vi.fn(), cursor: vi.fn(() => ({next}))};
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});

    await chat.fetch();

    expect(next).toHaveBeenCalledExactlyOnceWith(1);
    expect(chat.lastMessage).toEqual({});
    expect(chat.timestamp).toBeUndefined();
});

it("initializes from one cursor entry, then applies newer additions and edits without timestamp regression", async () => {
    const listeners = [];
    const removers = [];
    let resolveInitial;
    const next = vi.fn(() => new Promise(resolve => { resolveInitial = resolve; }));
    const database = {addEventListener: vi.fn((path, options) => {
        listeners.push(options);
        const remove = vi.fn();
        removers.push(remove);
        return {remove};
    }), cursor: vi.fn(() => ({next}))};
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});
    const changed = vi.fn();
    chat.watch(changed);
    expect(database.cursor).toHaveBeenCalledExactlyOnceWith(
        ["chats", {chat_id: "chat-1"}], {orderBy: "created", order: "desc"}
    );
    expect(next).toHaveBeenCalledExactlyOnceWith(1);
    expect(listeners[0]).toEqual({onChildAdd: expect.any(Function), onChildChange: expect.any(Function)});
    const first = {created: 10, text: "first"};
    const second = {created: 20, text: "newer"};
    listeners[0].onChildAdd({key: "b", value: second});
    expect(changed).not.toHaveBeenCalled();
    resolveInitial([{key: "a", value: first}]);
    await Promise.resolve();
    expect(changed).toHaveBeenCalledTimes(2);
    expect(chat.lastMessage).toEqual(second);
    listeners[0].onChildAdd({key: "b", value: second});
    listeners[0].onChildChange({key: "a", value: {...first, text: "old edit"}});
    expect(changed).toHaveBeenCalledTimes(2);
    listeners[0].onChildChange({key: "b", value: {...second, text: "edited"}});
    expect(changed).toHaveBeenCalledTimes(3);
    expect(chat.timestamp).toBe(20);
    chat.unwatch();
    expect(removers.every(remove => remove.mock.calls.length === 1)).toBe(true);
    listeners[0].onChildAdd({key: "c", value: {created: 30}});
    expect(changed).toHaveBeenCalledTimes(3);
});

it("ignores a pending cursor response after unwatch", async () => {
    let resolveInitial;
    const changed = vi.fn();
    const database = {
        addEventListener: vi.fn(() => ({remove: vi.fn()})),
        cursor: () => ({next: () => new Promise(resolve => { resolveInitial = resolve; })})
    };
    const chat = ChatMeta(database).create("chat-1", {members: {alice: 0}});
    chat.watch(changed);
    chat.unwatch();
    resolveInitial([{key: "a", value: {created: 10}}]);
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
});

it("deduplicates an addition already returned by the initialization cursor", async () => {
    let messageListener;
    const message = {created: 10, text: "same"};
    const database = {
        addEventListener: vi.fn((path, options) => {
            if (options.onChildAdd) messageListener = options;
            return {remove: vi.fn()};
        }),
        cursor: () => ({next: async () => [{key: "a", value: message}]})
    };
    const changed = vi.fn();
    ChatMeta(database).create("chat-1", {members: {alice: 0}}).watch(changed);
    messageListener.onChildAdd({key: "a", value: message});
    await Promise.resolve();
    expect(changed).toHaveBeenCalledExactlyOnceWith(message);
});
