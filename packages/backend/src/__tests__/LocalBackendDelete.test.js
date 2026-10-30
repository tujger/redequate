import {IDBFactory, IDBDatabase, IDBObjectStore} from "fake-indexeddb";
import createLocalDatabase, {readNativeStore} from "../../../database/src/__tests__/createLocalDatabase";
import LocalBackend from "../local/LocalBackend";
import {observeWrites} from "../local/database/callable/createHelpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const post = ["posts", {post_id: "p1"}];
const setup = async (storageId = "backend-delete") => {
    const database = createLocalDatabase({storageId});
    await database.read(["posts"]);
    const backend = new LocalBackend({storageId});
    const remove = (...args) => backend.request("database.delete", ...args);
    return {database, backend, remove};
};

it("deletes records directly and leaves siblings intact without calling LocalDatabase.delete", async () => {
    const {database, remove} = await setup();
    await database.create(post, {text: "A"});
    await database.create(["posts", {post_id: "p2"}], {text: "B"});
    const delegated = vi.spyOn(database, "delete").mockImplementation(() => { throw new Error("recursive delete"); });
    expect(await remove(post)).toBeNull();
    expect(await database.read(post)).toBeUndefined();
    expect(await database.read(["posts"])).toEqual({p2: {text: "B"}});
    expect(await remove(post)).toBeNull();
    expect(delegated).not.toHaveBeenCalled();
});

it("deletes nested properties, array items and unindexed singleton fields", async () => {
    const {database, remove} = await setup();
    await database.create(post, {nested: {remove: false, keep: 0}, list: [1, 2]});
    await remove([...post, "nested", {field: "remove"}]);
    await remove([...post, "list", {index: "0"}]);
    const value = await database.read(post);
    expect(value.nested).toEqual({keep: 0});
    expect(value.list).toHaveLength(2);
    expect(Object.hasOwn(value.list, 0)).toBe(false);
    expect(value.list[1]).toBe(2);
    await database.update(["meta"], {settings: {theme: "dark"}, maintenance: false});
    await remove(["meta", "maintenance"]);
    expect(await database.read(["meta"])).toEqual({settings: {theme: "dark"}});
    await remove(["meta"]);
    expect(await readNativeStore("backend-delete", "meta")).toEqual([]);
});

it("does not create records or empty branches when deleting absent nested values", async () => {
    const {database, remove} = await setup();
    for (const path of [[...post, "missing", "child"], ["meta", "missing", "child"]]) {
        expect(await remove(path)).toBeNull();
        expect(await remove(path)).toBeNull();
    }
    expect(await readNativeStore("backend-delete", "posts")).toEqual([]);
    expect(await readNativeStore("backend-delete", "meta")).toEqual([]);
    await database.create(post, {keep: true});
    await remove([...post, "missing", "child"]);
    expect(await database.read(post)).toEqual({keep: true});
    await database.update(new Map([[post, false]]));
    await remove([...post, "missing", "child"]);
    expect(await database.read(post)).toBe(false);
});

it("deletes compound-index scopes and complete collections without touching other stores", async () => {
    const {database, remove} = await setup();
    for (const [chat_id, message_id] of [["c1", "m1"], ["c1", "m2"], ["c2", "m1"]]) {
        await database.create(["chats", {chat_id}, {message_id}], {text: message_id});
    }
    await database.create(post, {keep: true});
    await remove(["chats", {chat_id: "c1"}]);
    expect(await database.read(["chats", {chat_id: "c1"}, "message_id"])).toBeUndefined();
    expect(await database.read(["chats", {chat_id: "c2"}, {message_id: "m1"}])).toEqual({text: "m1"});
    await remove(["chats"]);
    expect(await readNativeStore("backend-delete", "chats")).toEqual([]);
    expect(await database.read(post)).toEqual({keep: true});
});

it("supports string and native primary-key addresses, including scalar records", async () => {
    const {database, remove} = await setup();
    await database.create(post, {text: "A"});
    await remove("posts/p1/text");
    expect(await database.read(post)).toEqual({});
    await remove(["posts", {_id: "1"}]);
    expect(await readNativeStore("backend-delete", "posts")).toEqual([]);
    await database.update(new Map([[["roles", {user_id: "u"}], "admin"]]));
    await remove(["roles", {user_id: "u"}]);
    expect(await database.read(["roles", {user_id: "u"}])).toBeUndefined();
});

it("notifies listeners after commit with decoded removed values", async () => {
    const {database, remove} = await setup();
    await database.create(post, {text: "A"});
    const onChange = vi.fn(), onChildRemove = vi.fn();
    const listener = database.addEventListener(["posts"], {onChange, onChildRemove});
    const snapshots = [];
    const committed = vi.fn(async () => {
        snapshots.push(await readNativeStore("backend-delete", "posts"));
    });
    const stop = observeWrites("backend-delete", committed);
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        await remove(post);
        expect(committed).toHaveBeenCalledExactlyOnceWith("posts");
        expect(snapshots).toEqual([[]]);
        expect(onChildRemove).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {text: "A"}});
        expect(onChange).toHaveBeenLastCalledWith(undefined);
    } finally { listener.remove(); stop(); }
});

it("rolls back a failed collection deletion, closes the connection and sends no notifications", async () => {
    const {database, remove} = await setup();
    await database.create(post, {text: "A"});
    await database.create(["posts", {post_id: "p2"}], {text: "B"});
    const close = vi.spyOn(IDBDatabase.prototype, "close"), notified = vi.fn();
    const stop = observeWrites("backend-delete", notified);
    const originalDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete")
        .mockImplementationOnce(function (key) { return originalDelete.call(this, key); })
        .mockImplementationOnce(() => { throw new Error("delete failed"); });
    try {
        await expect(remove(["posts"])).rejects.toThrow("delete failed");
        expect(close).toHaveBeenCalledOnce();
        expect(notified).not.toHaveBeenCalled();
        expect(await database.read(["posts"])).toEqual({p1: {text: "A"}, p2: {text: "B"}});
    } finally { stop(); }
});

it("validates arguments before opening IndexedDB and never initializes missing stores", async () => {
    const backend = new LocalBackend({storageId: "unprepared-delete"});
    const open = vi.spyOn(globalThis.indexedDB, "open");
    for (const args of [[], [post, {}], [undefined], [null], [""], [[]], [["$auth"]],
        [["posts", {}]], [["posts", {post_id: 1}]]]) {
        await expect(backend.request("database.delete", ...args)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(open).not.toHaveBeenCalled();
    const close = vi.spyOn(IDBDatabase.prototype, "close");
    await expect(backend.request("database.delete", post)).rejects.toMatchObject({name: "NotFoundError"});
    expect(close).toHaveBeenCalledOnce();
});

it("rejects ambiguous nested addresses without changing data or notifying", async () => {
    const {database, remove} = await setup();
    await database.create(["chats", {chat_id: "c1"}, {message_id: "m1"}], {text: "A"});
    const notified = vi.fn(), stop = observeWrites("backend-delete", notified);
    try {
        await expect(remove(["chats", {chat_id: "c1"}, "text"]))
            .rejects.toMatchObject({code: "database/invalid-argument"});
        expect(notified).not.toHaveBeenCalled();
        expect(await database.read(["chats", {chat_id: "c1"}, {message_id: "m1"}])).toEqual({text: "A"});
    } finally { stop(); }
});

// Storage and delivery tests isolate application reactions; their effects have integration coverage.
vi.mock("../common", () => ({handlers: {}}));
