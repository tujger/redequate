import {IDBFactory} from "fake-indexeddb";
import {vi} from "vitest";
import LocalDatabase from "../../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("persists generated numeric keys without an injected timestamp and keeps explicit values and keys", async () => {
    const storageKey = "push-key-persistence";
    const database = new LocalDatabase({storageKey});
    const firstKey = await database.create(["posts", "post_id"], {text: "first"});
    const secondKey = await database.create(["posts", "post_id"], {text: "second", timestamp: 42});
    expect([firstKey, secondKey]).toEqual(["1", "2"]);
    await database.create(["posts", {post_id: "manual"}], {text: "manual"});
    const reopened = new LocalDatabase({storageKey});
    expect(await reopened.read(["posts", {post_id: firstKey}])).toEqual({text: "first"});
    expect(await reopened.read(["posts", {post_id: secondKey}])).toEqual({text: "second", timestamp: 42});
    expect(await reopened.read(["posts", {post_id: "manual"}])).toEqual({text: "manual"});
    await reopened.update(["posts", {post_id: firstKey}], {text: "edited"});
    expect(await database.read(["posts", {post_id: firstKey}])).toEqual({text: "edited"});
    await reopened.update(["posts", {post_id: secondKey}], {text: "edited"});
    expect(await database.read(["posts", {post_id: secondKey}])).toEqual({text: "edited", timestamp: 42});
    const cursor = reopened.cursor("posts");
    expect((await cursor.next(10)).map(({key}) => key)).toEqual([firstKey, secondKey, "manual"]);
});

it("creates under the supplied identity field and reads collections and records", async () => {
    const database = new LocalDatabase({storageKey: "create-read"});
    const path = ["posts", "post_id"];
    const key = await database.create(path, {created: 0});
    expect(await database.read(["posts"])).toMatchObject({[key]: {created: 0}});
    expect(await database.read(path)).toEqual({[key]: {created: 0}});
    expect(await database.read(["posts", {post_id: key}])).toMatchObject({created: 0});
    expect(await database.read(["posts", {post_id: key}, {"created": "created"}])).toBe(0);
    await database.update(["posts", {post_id: key}, "id"], () => "external");
    expect(await database.read(["posts", {post_id: key}, {"id": "id"}])).toBe("external");
    for (const created of [false, "", [1, 2], {value: 3}]) {
        await database.update(["posts", {post_id: key}, "created"], () => created);
        expect(await database.read(["posts", {post_id: key}, {"created": "created"}])).toEqual(created);
    }
});

it("keeps nested collection addresses and their identity fields", async () => {
    const database = new LocalDatabase({storageKey: "nested-create-read"});
    const chat = ["chats", {chat_id: "c"}];
    const message = await database.create([...chat, "message_id", "id"], {created: false});
    expect(await database.read([...chat, {"message_id": "message_id"}])).toMatchObject({
        [message]: {created: false}
    });
    expect(await database.read([...chat, "message_id", {id: message}, {"created": "created"}])).toBe(false);

    const post = [{type: "posts"}, {post_id: "p"}];
    const edit = await database.create([...post, "edit", "id"], {created: [1, 2]});
    expect(await database.read([...post, {"edit": "edit"}])).toMatchObject({
        [edit]: {created: [1, 2]}
    });
    expect(await database.read([...post, "edit", {id: edit}, {"created": "created"}])).toEqual([1, 2]);
});
