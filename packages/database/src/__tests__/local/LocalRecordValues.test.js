import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../../../../backend/src/local/LocalBackend";
import createLocalDatabase, {readNativeStore} from "../createLocalDatabase";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const path = ["posts", {post_id: "p1"}];
const put = (database, value, recordPath = path) => database.update(new Map([[recordPath, value]]));

it.each(["text", "", 0, 12.5, false, true, [], [1, false, {nested: "value"}]])(
    "round trips non-object value %j with physical identity fields", async value => {
        const database = createLocalDatabase({storageId: "value-roundtrip"});
        await database.read(["posts"]);
        await put(database, value);
        expect(await database.read(path)).toEqual(value);
        expect(await database.read(["posts"])).toEqual({p1: value});
        expect(await database.readSubtree(path)).toEqual(value);
        expect(await readNativeStore("value-roundtrip", "posts")).toEqual([
            {_id: 1, post_id: "p1", _value: value}
        ]);
    }
);

it("preserves native and compound identities across representation changes", async () => {
    const database = createLocalDatabase({storageId: "value-transition"});
    await database.read(["posts"]);
    const message = ["chats", {chat_id: "c1"}, {message_id: "m1"}];
    await put(database, {text: "old"}, message);
    await put(database, false, ["chats", {_id: "1"}]);
    expect(await database.read(message)).toBe(false);
    await put(database, [1, 2], message);
    await put(database, {text: "new"}, ["chats", {_id: "1"}]);
    expect(await readNativeStore("value-transition", "chats")).toEqual([
        {_id: 1, chat_id: "c1", message_id: "m1", text: "new"}
    ]);
    expect(await database.read(["chats", {chat_id: "c1"}, "message_id"])).toEqual({
        m1: {text: "new"}
    });
});

it("passes decoded values to callbacks and resolves backend increment markers and timestamps", async () => {
    const database = createLocalDatabase({storageId: "value-callback"});
    await database.read(["posts"]);
    const backend = new LocalBackend({storageId: database.storageId});
    await put(database, 2);
    expect(await database.update(path, value => {
        expect(value).toBe(2);
        return backend.increment(3);
    })).toBe(5);
    expect(await database.update(path, value => [value, false])).toEqual([5, false]);
    await database.update(path, value => { value.push("added"); return value; });
    expect(await database.read(path)).toEqual([5, false, "added"]);
    await put(database, database.TIMESTAMP);
    expect(await database.read(path)).toEqual(expect.any(Number));
    await database.update(path, () => null);
    expect(await database.read(path)).toBeUndefined();
});

it("reads and modifies nested arrays while permitting nested reserved names", async () => {
    const database = createLocalDatabase({storageId: "value-array"});
    await database.read(["posts"]);
    await put(database, [{nested: [1, 2], _value: "user", _encoded: true}]);
    const item = [...path, {index: "0"}];
    expect(await database.read([...item, {nested: "nested"}, {index: "1"}])).toBe(2);
    await database.update(new Map([[[...item, {nested: "nested"}, {index: "1"}], 3]]));
    expect(await database.read(path)).toEqual([{nested: [1, 3], _value: "user", _encoded: true}]);
});

it("encodes a singleton document without introducing indexes", async () => {
    const database = createLocalDatabase({storageId: "value-singleton"});
    await database.read(["posts"]);
    await put(database, false, ["meta"]);
    expect(await database.read(["meta"])).toBe(false);
    await put(database, ["a", "b"], ["meta"]);
    await put(database, "changed", ["meta", {index: "1"}]);
    expect(await database.read(["meta"])).toEqual(["a", "changed"]);
    await put(database, {settings: {_value: true}}, ["meta"]);
    expect(await readNativeStore("value-singleton", "meta")).toEqual([{_id: 1, settings: {_value: true}}]);
    await expect(database.read(["meta"], {equalTo: false})).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("filters and pages decoded values, and passes them to cursor handles", async () => {
    const database = createLocalDatabase({storageId: "value-query"});
    await database.read(["posts"]);
    await database.update(new Map([
        [["posts", {post_id: "a"}], false],
        [["posts", {post_id: "b"}], 2],
        [["posts", {post_id: "c"}], 1]
    ]));
    expect(await database.read(["posts"], {equalTo: false})).toEqual({a: false});
    expect(await database.read(["posts"], {orderBy: "", start: 1, end: 2})).toEqual({c: 1, b: 2});
    const cursor = database.cursor(["posts", "post_id"], {orderBy: "", start: 1});
    expect(await cursor.next(1)).toEqual([{key: "c", value: 1}]);
    expect(await cursor.next(1)).toEqual([{key: "b", value: 2}]);
    const editing = database.cursor(["posts", "post_id"], {
        equalTo: false, handle: ({value}) => { expect(value).toBe(false); return true; }
    });
    expect(await editing.next(10)).toEqual([{key: "a", value: true}]);
    expect(await database.read(["posts", {post_id: "a"}])).toBe(true);
});

it("notifies record listeners and cursor subscribers with decoded values after commit", async () => {
    const database = createLocalDatabase({storageId: "value-events"});
    await database.read(["posts"]);
    const onChange = vi.fn(), added = vi.fn(), changed = vi.fn(), removed = vi.fn();
    const listener = database.addEventListener(["posts"], {onChange, onChildAdd: added, onChildChange: changed, onChildRemove: removed});
    const events = [];
    const subscription = database.cursor(["posts", "post_id"]).subscribe(event => events.push(event));
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        await put(database, false);
        await put(database, [1, 2]);
        await database.delete(path);
        expect(added).toHaveBeenCalledExactlyOnceWith({key: "p1", value: false});
        expect(changed).toHaveBeenCalledExactlyOnceWith({key: "p1", value: [1, 2]});
        expect(removed).toHaveBeenCalledExactlyOnceWith({key: "p1", value: [1, 2]});
        expect(events).toEqual([
            {type: "add", entry: {key: "p1", value: false}},
            {type: "change", entry: {key: "p1", value: [1, 2]}},
            {type: "remove", entry: {key: "p1", value: [1, 2]}}
        ]);
        expect(onChange.mock.calls.map(([value]) => value)).toEqual([undefined, {p1: false}, {p1: [1, 2]}, undefined]);
    } finally { listener.remove(); subscription.unsubscribe(); }
});

it("rejects undefined atomically without leaking aborted changes", async () => {
    const database = createLocalDatabase({storageId: "value-rollback"});
    await database.read(["posts"]);
    await put(database, "original");
    await expect(database.update(new Map([
        [path, "changed"], [["posts", {post_id: "p2"}], undefined]
    ]))).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(path)).toBe("original");
    expect(await database.read(["posts", {post_id: "p2"}])).toBeUndefined();
    await expect(database.create(["posts", {post_id: "p2"}], false)).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("merges object changes into a scalar record without retaining its character properties", async () => {
    const database = createLocalDatabase({storageId: "value-merge"});
    await database.read(["posts"]);
    await put(database, "before");
    await database.update(path, {title: "after"});
    expect(await database.read(path)).toEqual({title: "after"});
});

it("decodes collection callback inputs and encodes replacement children inside their compound scope", async () => {
    const database = createLocalDatabase({storageId: "value-collection"});
    await database.read(["posts"]);
    const scope = ["chats", {chat_id: "c1"}];
    await database.update(new Map([
        [[...scope, {message_id: "a"}], "first"],
        [[...scope, {message_id: "b"}], [1, 2]],
        [["chats", {chat_id: "c2"}, {message_id: "a"}], "other"]
    ]));
    await database.update(scope, value => {
        expect(value).toEqual({a: "first", b: [1, 2]});
        return {a: true, c: 3};
    });
    expect(await database.read([...scope, "message_id"])).toEqual({a: true, c: 3});
    expect(await database.read(["chats", {chat_id: "c2"}, {message_id: "a"}])).toBe("other");
});


it("treats explicit native and unique-index fields as service keys", async () => {
    const database = createLocalDatabase({storageId: "service-keys"});
    await database.read(["posts"]);
    await database.create(path, {_id: "not-data", post_id: "p1", uid: "author", to: "parent", text: "Original"});
    expect(await database.read(path)).toEqual({uid: "author", to: "parent", text: "Original"});
    expect(await database.read(["posts"])).toEqual({p1: {uid: "author", to: "parent", text: "Original"}});
    const [physical] = await readNativeStore("service-keys", "posts");
    expect(physical).toEqual({_id: 1, post_id: "p1", uid: "author", to: "parent", text: "Original"});
    await database.update(path, current => {
        expect(current).not.toHaveProperty("post_id");
        expect(current).not.toHaveProperty("_id");
        return {...current, text: "Changed"};
    });
    expect((await readNativeStore("service-keys", "posts"))[0]._id).toBe(1);
});

it("removes nested service keys and prunes only their empty branches", async () => {
    const database = createLocalDatabase({storageId: "nested-keys", stores: [{
        store: "items", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [
            {name: "identity", keypath: "identity.id", options: {unique: true}},
            {name: "rank", keypath: "data.rank"}
        ]
    }]});
    await database.read(["items"]);
    const itemPath = ["items", {"identity.id": "a"}];
    await database.create(itemPath, {identity: {name: "Original"}, data: {rank: 2}});
    const expected = {identity: {name: "Original"}, data: {rank: 2}};
    expect(await database.read(itemPath)).toEqual(expected);
    expect(await database.read(["items"], {orderBy: "data/rank", equalTo: 2})).toEqual({a: expected});
    expect((await readNativeStore("nested-keys", "items"))[0]).toEqual({
        _id: 1, identity: {id: "a", name: "Original"}, data: {rank: 2}
    });
    await database.update(itemPath, () => ({data: {rank: 3}}));
    expect(await database.read(itemPath)).toEqual({data: {rank: 3}});
    expect(await database.read(["items"], {orderBy: "data/rank", equalTo: 2})).toBeUndefined();
});

it.each([
    {post_id: "p1", title: "old", _encoded: true, _value: {title: "old"}},
    {post_id: "p1", title: "old", _record: {type: "object", added: [["post_id"]]}},
    {post_id: "p1", _record: {type: "value"}, _value: "old"}
])("rejects old wrappers without migrating or rewriting them: %j", async legacy => {
    const database = createLocalDatabase({storageId: "old-records"});
    await database.read(["posts"]);
    const {openDatabase} = await import("../../local/helpers");
    const connection = await openDatabase("old-records");
    try {
        await new Promise((resolve, reject) => {
            const transaction = connection.transaction("posts", "readwrite");
            transaction.objectStore("posts").add(legacy);
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { connection.close(); }
    await expect(database.read(path)).rejects.toMatchObject({name: "VersionError"});
    const callback = vi.fn(() => ({title: "changed"}));
    await expect(database.update(path, callback)).rejects.toMatchObject({name: "VersionError"});
    expect(callback).not.toHaveBeenCalled();
    expect(await readNativeStore("old-records", "posts")).toEqual([{_id: 1, ...legacy}]);
});

it("includes the original path when a nested address is ambiguous", async () => {
    const database = createLocalDatabase({storageId: "ambiguous-path"});
    await database.read(["posts"]);
    const invalidPath = ["chats", {chat_id: "c1"}, {field: "title"}];
    await expect(database.read(invalidPath)).rejects.toMatchObject({
        code: "database/invalid-argument", message: expect.stringContaining(JSON.stringify(invalidPath))
    });
});

it("stores posts and counters without metadata, flags or duplicate payloads", async () => {
    const database = createLocalDatabase({storageId: "plain-records"});
    await database.read(["posts"]);
    const post = {created: 123, images: null, to: "parent", text: "message", uid: "author"};
    await put(database, post);
    await put(database, {like: 2}, ["_counters", {id: "counter"}]);
    expect(await readNativeStore("plain-records", "posts")).toEqual([{...post, post_id: "p1", _id: 1}]);
    expect(await readNativeStore("plain-records", "_counters")).toEqual([{like: 2, id: "counter", _id: 1}]);
    expect(await database.read(path)).toEqual(post);
    expect(await database.read(["_counters", {id: "counter"}])).toEqual({like: 2});
    expect(Object.keys(await database.read(["posts"], {orderBy: "uid", equalTo: "author"}))).toEqual(["p1"]);
});

it("removes explicitly selected address fields from stores without a unique index", async () => {
    const database = createLocalDatabase({storageId: "nonunique-addresses"});
    await database.read(["_counters"]);
    await put(database, {total: 2}, ["_counters", {gid: "group"}, {id: "one"}]);
    await put(database, {total: 3}, ["_counters", {gid: "group"}, {id: "two"}]);
    expect(await database.read(["_counters", {gid: "group"}, {id: "one"}])).toEqual({total: 2});
    expect(await database.read(["_counters", {gid: "group"}, "id"])).toEqual({one: {total: 2}, two: {total: 3}});
    expect(await database.cursor(["_counters", {gid: "group"}, "id"]).next(10)).toEqual([
        {key: "one", value: {total: 2}}, {key: "two", value: {total: 3}}
    ]);
});

it.each([{}, {identity: {}}])("does not create metadata for nested address branches: %j", async value => {
    const database = createLocalDatabase({storageId: "nested-parents", stores: [{
        store: "items", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [
            {name: "identity", keypath: "identity.id", options: {unique: true}}
        ]
    }]});
    await database.read(["items"]);
    const itemPath = ["items", {"identity.id": "a"}];
    await database.create(itemPath, value);
    expect(await database.read(itemPath)).toEqual({});
    expect(await readNativeStore("nested-parents", "items")).toEqual([{_id: 1, identity: {id: "a"}}]);
});

it.each([null, "original", false])("rejects incompatible indexed parents instead of storing restoration metadata: %j", async identity => {
    const database = createLocalDatabase({storageId: "invalid-parent", stores: [{
        store: "items", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [
            {name: "identity", keypath: "identity.id", options: {unique: true}}
        ]
    }]});
    await database.read(["items"]);
    await expect(database.create(["items", {"identity.id": "a"}], {identity})).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await readNativeStore("invalid-parent", "items")).toEqual([]);
});

it("removes a shared branch containing only compound service keys", async () => {
    const database = createLocalDatabase({storageId: "compound-parent", stores: [{
        store: "items", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [
            {name: "scope_key", keypath: ["identity.scope", "identity.key"], options: {unique: true}}
        ]
    }]});
    await database.read(["items"]);
    const itemPath = ["items", {"identity.scope": "scope"}, {"identity.key": "key"}];
    await database.create(itemPath, {text: "Original"});
    expect(await database.read(itemPath)).toEqual({text: "Original"});
    expect(await readNativeStore("compound-parent", "items")).toEqual([
        {_id: 1, identity: {scope: "scope", key: "key"}, text: "Original"}
    ]);
});

it.each(["_value", "_record", "_encoded"])("rejects reserved root field %s, but allows it in nested data", async name => {
    const database = createLocalDatabase({storageId: "reserved-fields"});
    await database.read(["posts"]);
    await expect(put(database, {[name]: "user"})).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(path)).toBeUndefined();
    await put(database, {nested: {[name]: "user"}});
    expect(await database.read(path)).toEqual({nested: {[name]: "user"}});
});


it("discards callback mutations without writes or notifications unless a value is returned", async () => {
    const storageId = "callback-no-change", database = createLocalDatabase({storageId});
    await database.read(["posts"]);
    await put(database, {nested: {keep: true}, list: [1, 2]});
    const before = await readNativeStore(storageId, "posts");
    const onChange = vi.fn(), changed = vi.fn(), removed = vi.fn();
    const listener = database.addEventListener(["posts"], {onChange, onChildChange: changed, onChildRemove: removed});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        expect(await database.update(path, copy => {
            copy.nested.keep = false;
            copy.list.push(3);
        })).toEqual({nested: {keep: true}, list: [1, 2]});
        expect(await database.update(path, () => undefined)).toEqual({nested: {keep: true}, list: [1, 2]});
        expect(await readNativeStore(storageId, "posts")).toEqual(before);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(changed).not.toHaveBeenCalled();
        expect(removed).not.toHaveBeenCalled();
        expect(await database.update(path, () => null)).toBeNull();
        expect(await database.read(path)).toBeUndefined();
        expect(removed).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {nested: {keep: true}, list: [1, 2]}});
    } finally { listener.remove(); }
});

it("leaves missing storage untouched when an update callback returns undefined", async () => {
    const storageId = "callback-missing", database = createLocalDatabase({storageId});
    await database.read(["posts"]);
    expect(await database.update(path, () => undefined)).toBeNull();
    expect(await database.read(path)).toBeUndefined();
    expect(await readNativeStore(storageId, "posts")).toEqual([]);
});

// Storage and delivery tests isolate application reactions; their effects have integration coverage.
vi.mock("../../../../backend/src/common", () => ({handlers: {}}));
