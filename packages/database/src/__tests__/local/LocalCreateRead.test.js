import {IDBFactory} from "fake-indexeddb";
import {vi} from "vitest";
import LocalDatabase from "../../local";
import {key as pushKey, milliseconds} from "firebase-key";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("persists push-keyed records without an injected timestamp and keeps explicit values and keys", async () => {
    const storageKey = "push-key-persistence";
    const database = new LocalDatabase({storageKey});
    const first = database.create(["posts", "post_id"]);
    const second = database.create(["posts", "post_id"]);
    expect(first.temporaryKey).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(second.temporaryKey).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(milliseconds(first.temporaryKey)).toBeLessThanOrEqual(milliseconds(second.temporaryKey));
    expect(Math.abs(milliseconds(first.temporaryKey) - Date.now())).toBeLessThan(60_000);
    expect(await first.save({text: "first"})).toBe(first.temporaryKey);
    await second.save({text: "second", timestamp: 42});
    const manual = database.create(["posts", {post_id: "manual"}]);
    await manual.save({text: "manual"});
    const reopened = new LocalDatabase({storageKey});
    expect(await reopened.read(["posts", {post_id: first.temporaryKey}])).toEqual({text: "first"});
    expect(await reopened.read(["posts", {post_id: second.temporaryKey}])).toEqual({text: "second", timestamp: 42});
    expect(await reopened.read(["posts", {post_id: "manual"}])).toEqual({text: "manual"});
    await reopened.update(["posts", {post_id: first.temporaryKey}], {text: "edited"});
    expect(await database.read(["posts", {post_id: first.temporaryKey}])).toEqual({text: "edited"});
    await reopened.update(["posts", {post_id: second.temporaryKey}], {text: "edited"});
    expect(await database.read(["posts", {post_id: second.temporaryKey}])).toEqual({text: "edited", timestamp: 42});
    const cursor = reopened.cursor("posts");
    expect((await cursor.next(10)).map(({key}) => key)).toEqual([first.temporaryKey, second.temporaryKey, "manual"]);
    expect(milliseconds(pushKey(42, "min"))).toBe(42);
    expect(milliseconds(pushKey(new Date(42), "max"))).toBe(42);
});

it("creates under the supplied identity field and reads collections and records", async () => {
    const database = new LocalDatabase({storageKey: "create-read"});
    const path = ["posts", "post_id"];
    const key = await database.create(path).save({created: 0});
    expect(await database.read(["posts"])).toMatchObject({[key]: {created: 0}});
    expect(await database.read(path)).toBeUndefined();
    expect(await database.read(["posts", {post_id: key}])).toMatchObject({created: 0});
    expect(await database.read(["posts", {post_id: key}, "created"])).toBe(0);
    await database.update(["posts", {post_id: key}, "id"], () => "external");
    expect(await database.read(["posts", {post_id: key}, "id"])).toBe("external");
    for (const created of [false, "", [1, 2], {value: 3}]) {
        await database.update(["posts", {post_id: key}, "created"], () => created);
        expect(await database.read(["posts", {post_id: key}, "created"])).toEqual(created);
    }
});

it("keeps nested collection addresses and their identity fields", async () => {
    const database = new LocalDatabase({storageKey: "nested-create-read"});
    const chat = ["chats", {chat_id: "c"}];
    const message = await database.create([...chat, "message_id", "id"]).save({created: false});
    expect(await database.read([...chat, "message_id"])).toMatchObject({
        [message]: {created: false}
    });
    expect(await database.read([...chat, "message_id", {id: message}, "created"])).toBe(false);

    const post = [{type: "posts"}, {post_id: "p"}];
    const edit = await database.create([...post, "edit", "id"]).save({created: [1, 2]});
    expect(await database.read([...post, "edit"])).toMatchObject({
        [edit]: {created: [1, 2]}
    });
    expect(await database.read([...post, "edit", {id: edit}, "created"])).toEqual([1, 2]);
});
