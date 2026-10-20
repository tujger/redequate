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
