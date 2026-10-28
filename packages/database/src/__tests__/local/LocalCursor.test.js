import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const setup = async (storageId = "native-cursors") => {
    const database = new LocalDatabase({storageId, backend: new LocalBackend({storageId})});
    await database.read(["posts"]);
    return database;
};

it("pages plain records by indexed fields and applies cursor replacements to the same native rows", async () => {
    const database = await setup();
    for (const [post_id, to] of [["p1", 3], ["p2", 1], ["p3", 2]]) await database.create(["posts", {post_id}], {to});
    const cursor = database.cursor(["posts", "post_id"], {orderBy: "to"});
    expect((await cursor.next(1)).map(entry => entry.key)).toEqual(["p2"]);
    expect((await cursor.next(2)).map(entry => entry.key)).toEqual(["p3", "p1"]);
    const editing = database.cursor(["posts", "post_id"], {handle: ({value}) => ({...value, title: "handled"})});
    const entries = await editing.next(10);
    expect(entries).toHaveLength(3);
    expect(entries.every(({value}) => value.title === "handled" && !Object.hasOwn(value, "post_id") && !Object.hasOwn(value, "_id"))).toBe(true);
    expect((await database.read(["posts", {post_id: "p1"}])).title).toBe("handled");
});

it("pages a compound-index scope without leaking sibling records", async () => {
    const database = await setup();
    for (const [chat_id, message_id, created] of [["c1", "m1", 1], ["c1", "m2", 3], ["c2", "m3", 2]]) {
        await database.create(["chats", {chat_id}, {message_id}], {created});
    }
    const cursor = database.cursor(["chats", {chat_id: "c1"}, "message_id"], {orderBy: "created", order: "desc"});
    expect((await cursor.next(10)).map(({key}) => key)).toEqual(["m2", "m1"]);
});

it("keeps nested collection cursor changes in the parent object", async () => {
    const database = await setup();
    await database.create(["posts", {post_id: "p1"}], {edits: {a: {text: "A"}, b: {text: "B"}}});
    const cursor = database.cursor(["posts", {post_id: "p1"}, "edits", "edit_id"], {
        handle: ({key, value}) => key === "a" ? null : {...value, text: "changed"}
    });
    expect((await cursor.next(10)).map(({key}) => key)).toEqual(["b"]);
    expect((await database.read(["posts", {post_id: "p1"}])).edits).toEqual({b: {text: "changed"}});
});

it("delivers committed creates, updates and deletions once with ordinary fields", async () => {
    const database = await setup();
    const onChange = vi.fn(), added = vi.fn(), changed = vi.fn(), removed = vi.fn();
    const listener = database.addEventListener(["posts"], {onChange, onChildAdd: added, onChildChange: changed, onChildRemove: removed});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        await database.create(["posts", {post_id: "p1"}], {title: "A"});
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(added).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {title: "A"}});
        await database.update(["posts", {post_id: "p1"}], {title: "B"});
        expect(changed).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {title: "B"}});
        await database.delete(["posts", {post_id: "p1"}]);
        expect(removed).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {title: "B"}});
        const count = onChange.mock.calls.length;
        await expect(database.update(["posts", {post_id: "p1"}], () => { throw new Error("rollback"); })).rejects.toThrow("rollback");
        expect(onChange).toHaveBeenCalledTimes(count);
    } finally { listener.remove(); }
});

it("subscribes to native query collections and keeps independent subscription handles", async () => {
    const database = await setup();
    const events = [], second = [];
    const cursor = database.cursor(["posts", "post_id"], {orderBy: "to", start: 2});
    const one = cursor.subscribe(event => events.push(event));
    const two = cursor.subscribe(event => second.push(event));
    try {
        await new Promise(resolve => setTimeout(resolve, 0));
        await database.create(["posts", {post_id: "p1"}], {to: 1});
        expect(events).toEqual([]);
        await database.update(["posts", {post_id: "p1"}], {to: 2});
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({type: "add", entry: {key: "p1", value: {to: 2}}});
        one.unsubscribe();
        await database.update(["posts", {post_id: "p1"}], {to: 3});
        expect(events).toHaveLength(1);
        expect(second).toHaveLength(2);
    } finally { one.unsubscribe(); two.unsubscribe(); }
});

it("refreshes the unindexed singleton document after changes to its fields", async () => {
    const database = await setup();
    const values = [];
    const listener = database.addEventListener(["meta"], {onChange: value => values.push(value)});
    try {
        await vi.waitFor(() => expect(values).toHaveLength(1));
        await database.update(new Map([[["meta", "settings"], {theme: "dark"}]]));
        expect(values.at(-1)).toEqual({settings: {theme: "dark"}});
        await database.update(["meta", "settings"], {locale: "en"});
        expect(values.at(-1)).toEqual({settings: {theme: "dark", locale: "en"}});
    } finally { listener.remove(); }
});

it("sends a complete handler replacement through the supplied backend and rereads resolved markers", async () => {
    const storageId = "cursor-backend-replacement", backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["posts"]);
    await database.create(["posts", {post_id: "p1"}], {count: 3, obsolete: true});
    const request = vi.spyOn(backend, "request");
    const replacement = {count: backend.increment(2), time: database.TIMESTAMP};
    const handle = vi.fn(() => replacement);
    const cursor = database.cursor(["posts", "post_id"], {handle});
    const entries = await cursor.next(10);
    expect(handle).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {count: 3, obsolete: true}});
    expect(request.mock.calls).toEqual([
        ["database.update", ["posts", {post_id: "p1"}], null, {mode: "read"}],
        ["database.update", ["posts", {post_id: "p1"}], replacement, {mode: "replace", etag: expect.any(String)}]
    ]);
    expect(entries).toEqual([{key: "p1", value: {count: 5, time: expect.any(Number)}}]);
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual(entries[0].value);
});

it("skips backend writes for undefined handler results and propagates backend failures without local fallback", async () => {
    const storageId = "cursor-backend-failure", backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["posts"]);
    await database.create(["posts", {post_id: "p1"}], {text: "original"});
    const request = vi.spyOn(backend, "request");
    const unchanged = database.cursor(["posts", "post_id"], {handle: ({value}) => { value.text = "ignored"; }});
    expect(await unchanged.next(10)).toEqual([{key: "p1", value: {text: "original"}}]);
    expect(request).not.toHaveBeenCalled();
    const failure = new Error("backend unavailable");
    request.mockRejectedValueOnce(failure);
    const editing = database.cursor(["posts", "post_id"], {handle: () => ({text: "changed"})});
    await expect(editing.next(10)).rejects.toBe(failure);
    expect(await database.read(["posts", {post_id: "p1"}])).toEqual({text: "original"});
});

it("requires backend only when a cursor handler requests a replacement", async () => {
    const writer = await setup("cursor-missing-backend");
    await writer.create(["posts", {post_id: "p1"}], {text: "original"});
    const database = new LocalDatabase({storageId: "cursor-missing-backend"});
    expect(await database.cursor(["posts", "post_id"]).next(10)).toEqual([{key: "p1", value: {text: "original"}}]);
    const cursor = database.cursor(["posts", "post_id"], {handle: () => ({text: "changed"})});
    await expect(cursor.next(10)).rejects.toBeInstanceOf(TypeError);
    expect(await writer.read(["posts", {post_id: "p1"}])).toEqual({text: "original"});
});

it("routes compound-scope handler writes through backend without changing sibling scopes", async () => {
    const storageId = "cursor-backend-scope", backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["chats"]);
    for (const chat_id of ["c1", "c2"]) await database.create(["chats", {chat_id}, {message_id: "m1"}], {text: "original"});
    const request = vi.spyOn(backend, "request");
    const cursor = database.cursor(["chats", {chat_id: "c1"}, "message_id"], {handle: () => ({text: "changed"})});
    expect(await cursor.next(10)).toEqual([{key: "m1", value: {text: "changed"}}]);
    expect(request.mock.calls[1]).toEqual([
        "database.update", ["chats", {chat_id: "c1"}, {message_id: "m1"}], {text: "changed"}, {mode: "replace", etag: expect.any(String)}
    ]);
    expect(await database.read(["chats", {chat_id: "c2"}, {message_id: "m1"}])).toEqual({text: "original"});
});

// Storage and delivery tests isolate application reactions; their effects have integration coverage.
vi.mock("../../../../backend/src/common", () => ({handlers: {
    extra: {path: ["extra", "extra_id"], onWrite() {}},
    post: {path: ["posts", "post_id"], onWrite() {}},
}}));
