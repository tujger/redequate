import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

it("delegates ordinary values with their original nested collection paths", async () => {
    const {firebase, sdk} = createFirebase();
    const backend = {request: vi.fn().mockResolvedValue("backend-key")};
    const database = new FirebaseDatabase({firebase, backend});
    for (const path of [
        ["posts", "post_id"],
        ["chats", {chat_id: "c"}, "message_id", "id"],
        [{type: "posts"}, {post_id: "p"}, "edit", "id"]
    ]) {
        expect(await database.create(path, {created: 0})).toBe("backend-key");
        expect(backend.request).toHaveBeenLastCalledWith("database.create", path, {created: 0});
    }
    expect(sdk.refs).toHaveLength(0);
});

it("prepares distinct callback keys before concurrent backend requests", async () => {
    const {firebase} = createFirebase();
    const backend = {request: vi.fn(async (_name, path) => path.at(-1).post_id)};
    const database = new FirebaseDatabase({firebase, backend});
    const keys = await Promise.all(Array.from({length: 8}, () =>
        database.create(["posts", "post_id"], key => ({key}))));
    expect(new Set(keys).size).toBe(8);
    expect(backend.request).toHaveBeenCalledTimes(8);
    for (const key of keys) expect(backend.request).toHaveBeenCalledWith("database.create", ["posts", {post_id: key}], {key});
});

it("reads identity collections, records and complete field values", async () => {
    const {firebase, sdk, snapshot} = createFirebase();
    const database = new FirebaseDatabase({firebase});
    const cases = [
        [["posts"], "posts", {p: {created: 0}}],
        [["posts", {post_id: "post_id"}], "posts/post_id", false],
        [["posts", {post_id: "p"}], "posts/p", {created: 0}],
        [["posts", {post_id: "p"}, {created: "created"}], "posts/p/created", 0],
        [["posts", {post_id: "p"}, {id: "id"}], "posts/p/id", "external"],
        [["chats", {chat_id: "c"}, {message_id: "message_id"}], "chats/c/message_id", {m: {created: false}}],
        [[{type: "posts"}, {post_id: "p"}, {edit: "edit"}], "posts/p/edit", {e: {created: [1, 2]}}],
        [["meta", {settings: "settings"}], "meta/settings", {theme: "dark"}]
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
