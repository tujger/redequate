import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

it("creates at the parent address, including nested collection paths", async () => {
    const {firebase, sdk} = createFirebase();
    const database = new FirebaseDatabase({firebase});
    for (const [path, parent] of [
        [["posts", "post_id"], "posts"],
        [["chats", {chat_id: "c"}, "message_id", "id"], "chats/c/message_id"],
        [[{type: "posts"}, {post_id: "p"}, "edit", "id"], "posts/p/edit"]
    ]) {
        const draft = database.create(path);
        await draft.save({created: 0});
        expect(sdk.transaction.mock.calls.at(-1)[0].path).toBe(`${parent}/${draft.temporaryKey}`);
    }
});

it("reads identity collections, records and complete field values", async () => {
    const {firebase, sdk, snapshot} = createFirebase();
    const database = new FirebaseDatabase({firebase});
    const cases = [
        [["posts"], "posts", {p: {created: 0}}],
        [["posts", "post_id"], "posts/post_id", false],
        [["posts", {post_id: "p"}], "posts/p", {created: 0}],
        [["posts", {post_id: "p"}, "created"], "posts/p/created", 0],
        [["posts", {post_id: "p"}, "id"], "posts/p/id", "external"],
        [["chats", {chat_id: "c"}, "message_id"], "chats/c/message_id", {m: {created: false}}],
        [[{type: "posts"}, {post_id: "p"}, "edit"], "posts/p/edit", {e: {created: [1, 2]}}],
        [["meta", "settings"], "meta/settings", {theme: "dark"}]
    ];
    for (const [path, address, value] of cases) {
        sdk.once.mockResolvedValueOnce(snapshot(value));
        expect(await database.read(path)).toEqual(value);
        expect(sdk.once.mock.calls.at(-1)[0].path).toBe(address);
    }
    await database.read(["posts"], {orderBy: ["created"]});
    expect(sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["created"]});
    await database.read(["posts"], {orderBy: "created", equalTo: false});
    expect(sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["created"], equalTo: [false]});
});
