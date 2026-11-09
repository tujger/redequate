import {IDBFactory} from "fake-indexeddb";
import createLocalDatabase, {readNativeStore} from "../createLocalDatabase";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
vi.mock("../../../../backend/src/common", () => ({handlers: {}}));

const stamp = ["mutualstamps", {mutual_type: "_my"}, {user_id: "u1"}, {mutual_id: "m1"}];
const setup = async () => {
    const database = createLocalDatabase({storageId: "named-address"});
    await database.read(["mutualstamps"]);
    return database;
};

it("rejects positional values before record identification", async () => {
    const database = await setup();
    for (const path of [
        ["mutualstamps", "_my", {user_id: "u1"}, {mutual_id: "m1"}],
        ["mutualstamps", "_my", {user_id: "u1"}],
        ["chats", {chat_id: "c1"}, "text"]
    ]) {
        await expect(database.readSubtree(path)).rejects.toMatchObject({code: "database/invalid-argument"});
        await expect(database.update(path, {value: true})).rejects.toMatchObject({code: "database/invalid-argument"});
    }
});

it("supports named compound CRUD, scoped collections and nested properties", async () => {
    const database = await setup();
    await database.create(stamp, {nested: {a: 1}});
    expect((await readNativeStore(database.storageId, "mutualstamps"))[0]).toMatchObject({
        mutual_type: "_my", user_id: "u1", mutual_id: "m1"
    });
    await database.update([...stamp, "nested"], {a: 2});
    expect(await database.read([...stamp, "nested", {a: "a"}])).toBe(2);
    const scope = stamp.slice(0, -1);
    expect(Object.keys(await database.read([...scope, "mutual_id"]))).toEqual(["m1"]);
    expect((await database.cursor([...scope, "mutual_id"]).next(10)).map(entry => entry.key)).toEqual(["m1"]);
    await expect(database.update(new Map([[stamp, {value: 2}], [[...stamp, "nested"], {}]])))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read([...stamp, "nested", {a: "a"}])).toBe(2);
    await database.delete(stamp);
    expect(await database.read(stamp)).toBeUndefined();
});

it.each([false, true])("creates both compound identity values with callback=%s", async callback => {
    const database = await setup();
    const value = callback ? vi.fn((chatId, messageId) => ({chatId, messageId})) : {text: "new"};
    const path = ["chats", "chat_id", "message_id"];
    const key = await database.create(path, value);
    const [row] = await readNativeStore(database.storageId, "chats");
    expect(row.chat_id).toMatch(/^[-0-9A-Z_a-z]{20}$/);
    expect(row.message_id).toBe(key);
    expect(row.chat_id).not.toBe(key);
    if (callback) expect(value).toHaveBeenCalledExactlyOnceWith(row.chat_id, row.message_id);
    expect(await database.read(["chats", {chat_id: row.chat_id}, {message_id: key}])).toBeDefined();
    expect(path).toEqual(["chats", "chat_id", "message_id"]);
});

it("stores metadata as the only row in a newly allocated chat", async () => {
    const database = await setup();
    let chatId;
    await database.create(["chats", "chat_id", {message_id: "!meta"}], key => {
        chatId = key;
        return {members: {alice: 0, bob: 0}};
    });
    expect(await readNativeStore(database.storageId, "chats")).toEqual([
        expect.objectContaining({chat_id: chatId, message_id: "!meta", members: {alice: 0, bob: 0}})
    ]);
    expect((await database.cursor(["chats", {chat_id: chatId}, "message_id"]).next(10)).map(entry => entry.key))
        .toEqual(["!meta"]);
});

it("subscribes to per-user chat IDs without requiring a message ID", async () => {
    const database = await setup();
    const path = chatId => ["_chats", {user_id: "me"}, {chat_id: chatId}];
    await database.create(path("a"), {timestamp: 1});
    await database.create(["_chats", {user_id: "other"}, {chat_id: "hidden"}], {timestamp: 2});
    const onChange = vi.fn(), onChildAdd = vi.fn(), onChildChange = vi.fn(), onError = vi.fn();
    const listener = database.addEventListener(["_chats", {user_id: "me"}, "chat_id"],
        {onChange, onChildAdd, onChildChange, onError});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
        expect(Object.keys(onChange.mock.calls.at(-1)[0])).toEqual(["a"]);
        await database.update(path("a"), {timestamp: 3});
        await vi.waitFor(() => expect(onChildChange).toHaveBeenCalledWith({key: "a", value: {timestamp: 3}}));
        await database.create(path("z"), {timestamp: 4});
        await vi.waitFor(() => expect(onChildAdd).toHaveBeenCalledWith({key: "z", value: {timestamp: 4}}));
        expect(onError).not.toHaveBeenCalled();
    } finally { listener.remove(); }
});
