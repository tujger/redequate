import ChatListener from "../common/handlers/chats";

const params = {chat_id: "chat", message_id: "message"};
let backend, listener;
beforeEach(() => {
    backend = {projectUrl: "https://app.test", request: vi.fn()};
    listener = new ChatListener(backend);
});

it.each([
    ["!meta", {members: {alice: 0}}],
    ["!meta", {uid: "alice", members: {alice: 0}}],
    ["legacy", {redirect: true, meta: {members: {alice: 0}}}],
    ["legacy", null], ["legacy", {}], ["legacy", {uid: ""}], ["legacy", {uid: 1}]
])("ignores non-message records %s %j without any requests", async (message_id, value) => {
    await listener.onCreate({params: {...params, message_id}, value});
    expect(backend.request).not.toHaveBeenCalled();
});

it("notifies active recipients using the explicit member map, excluding the sender", async () => {
    backend.request.mockResolvedValueOnce("Alice")
        .mockResolvedValueOnce({alice: 0, bob: 1, departed: 0})
        .mockResolvedValueOnce({timestamp: 2})
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(null);
    await listener.onCreate({params, value: {uid: "alice", text: "hello"}});
    expect(backend.request.mock.calls).toEqual([
        ["database.read", ["users_public", {user_id: "alice"}, {name: "name"}]],
        ["database.read", ["chats", {chat_id: "chat"}, {message_id: "!meta"}, {members: "members"}]],
        ["database.read", ["_chats", {user_id: "bob"}, {chat_id: "chat"}]],
        ["notification.send", {userId: "bob", data: {body: "Alice: hello", tag: "https://app.test/chat/alice", type: "chat"}}],
        ["database.read", ["_chats", {user_id: "departed"}, {chat_id: "chat"}]]
    ]);
});

it.each([null, {}])("rejects an absent member map %j without sending notifications", async members => {
    backend.request.mockResolvedValueOnce("Alice").mockResolvedValueOnce(members);
    await expect(listener.onCreate({params, value: {uid: "alice", text: "hello"}}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(backend.request).toHaveBeenCalledTimes(2);
});
