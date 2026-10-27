import {IDBFactory} from "fake-indexeddb";
import createLocalDatabase, {readNativeStore} from "../createLocalDatabase";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const path = ["posts", {post_id: "p1"}];
const put = (database, value, recordPath = path) => database.update(new Map([[recordPath, value]]));

it.each(["text", "", 0, 12.5, false, true, [], [1, false, {nested: "value"}]])(
    "round trips non-object value %j with physical identity fields", async value => {
        const database = createLocalDatabase({storageId: "value-roundtrip"});
        await put(database, value);
        expect(await database.read(path)).toEqual(value);
        expect(await database.read(["posts"])).toEqual({p1: value});
        expect(await database.readSubtree(path)).toEqual(value);
        expect(await readNativeStore("value-roundtrip", "posts")).toEqual([
            {_id: 1, post_id: "p1", _encoded: true, _value: value}
        ]);
    }
);

it("preserves native and compound identities across representation changes", async () => {
    const database = createLocalDatabase({storageId: "value-transition"});
    const message = ["chats", {chat_id: "c1"}, {message_id: "m1"}];
    await put(database, {text: "old"}, message);
    await put(database, false, ["chats", {_id: "1"}]);
    expect(await database.read(message)).toBe(false);
    await put(database, [1, 2], message);
    await put(database, {text: "new"}, ["chats", {_id: "1"}]);
    expect(await readNativeStore("value-transition", "chats")).toEqual([
        {_id: 1, chat_id: "c1", message_id: "m1", text: "new", _encoded: true, _value: {text: "new"}}
    ]);
    expect(await database.read(["chats", {chat_id: "c1"}, "message_id"])).toEqual({
        m1: {text: "new"}
    });
});

it("passes decoded values to callbacks and resolves root increment and timestamp markers", async () => {
    const database = createLocalDatabase({storageId: "value-callback"});
    await put(database, 2);
    expect(await database.update(path, value => {
        expect(value).toBe(2);
        return database.increment(3);
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
    await put(database, [{nested: [1, 2], _value: "user", _encoded: true}]);
    const item = [...path, {index: "0"}];
    expect(await database.read([...item, {nested: "nested"}, {index: "1"}])).toBe(2);
    await database.update(new Map([[[...item, {nested: "nested"}, {index: "1"}], 3]]));
    expect(await database.read(path)).toEqual([{nested: [1, 3], _value: "user", _encoded: true}]);
});

it("encodes a singleton document without introducing indexes", async () => {
    const database = createLocalDatabase({storageId: "value-singleton"});
    await put(database, false, ["meta"]);
    expect(await database.read(["meta"])).toBe(false);
    await put(database, ["a", "b"], ["meta"]);
    await put(database, "changed", ["meta", {index: "1"}]);
    expect(await database.read(["meta"])).toEqual(["a", "changed"]);
    await put(database, {settings: {_value: true}}, ["meta"]);
    expect(await readNativeStore("value-singleton", "meta")).toEqual([{_id: 1, settings: {_value: true}, _encoded: true, _value: {settings: {_value: true}}}]);
    await expect(database.read(["meta"], {equalTo: false})).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("filters and pages decoded values, and passes them to cursor handles", async () => {
    const database = createLocalDatabase({storageId: "value-query"});
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
    const onChange = vi.fn(), added = vi.fn(), changed = vi.fn(), removed = vi.fn();
    const listener = database.addEventListener(["posts"], {onChange, onChildAdd: added, onChildChange: changed, onChildRemove: removed});
    const events = [];
    const subscription = database.cursor(["posts", "post_id"]).subscribe(event => events.push(event));
    try {
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
    await put(database, "before");
    await database.update(path, {title: "after"});
    expect(await database.read(path)).toEqual({title: "after"});
});

it("decodes collection callback inputs and encodes replacement children inside their compound scope", async () => {
    const database = createLocalDatabase({storageId: "value-collection"});
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

it("preserves explicit identity fields and wrapper-like properties as original user data", async () => {
    const database = createLocalDatabase({storageId: "exact-object"});
    await database.read(["posts"]);
    const value = {post_id: "p1", _id: "logical-id", _encoded: false, _value: {user: true}, title: "original"};
    await database.create(path, value);
    expect(await database.read(path)).toEqual(value);
    expect(await database.read(["posts"])).toEqual({p1: value});
    await database.update(path, current => {
        expect(current).toEqual(value);
        return {...current, title: "changed"};
    });
    expect(await database.read(path)).toEqual({...value, title: "changed"});
    const [physical] = await readNativeStore("exact-object", "posts");
    expect(physical._id).toBe(1);
    expect(physical._value).toEqual({...value, title: "changed"});
    await database.update(new Map([[[...path, {field: "_id"}], "changed-logical-id"]]));
    expect((await readNativeStore("exact-object", "posts"))[0]._id).toBe(1);
    expect((await database.read(path))._id).toBe("changed-logical-id");
});

it("keeps nested index projections independent of the original value", async () => {
    const database = createLocalDatabase({storageId: "nested-projection", stores: [{
        store: "items", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [
            {name: "identity", keypath: "identity.id", options: {unique: true}},
            {name: "rank", keypath: "data.rank"}
        ]
    }]});
    await database.read(["items"]);
    const itemPath = ["items", {"identity.id": "a"}];
    const value = {identity: {name: "Original"}, data: {rank: 2}};
    await database.create(itemPath, value);
    expect(await database.read(itemPath)).toEqual(value);
    expect(await database.read(["items"], {orderBy: "data/rank", equalTo: 2})).toEqual({a: value});
    const [physical] = await readNativeStore("nested-projection", "items");
    expect(physical.identity).toEqual({id: "a", name: "Original"});
    expect(physical._value.identity).toEqual({name: "Original"});
    await database.update(itemPath, {data: {rank: 3}});
    expect(await database.read(["items"], {orderBy: "data/rank", equalTo: 2})).toBeUndefined();
    expect(await database.read(itemPath)).toEqual({...value, data: {rank: 3}});
});

it("rejects old physical records without migrating or rewriting them", async () => {
    const database = createLocalDatabase({storageId: "old-records"});
    await database.read(["posts"]);
    const {openDatabase} = await import("../../local/helpers");
    const connection = await openDatabase("old-records");
    try {
        await new Promise((resolve, reject) => {
            const transaction = connection.transaction("posts", "readwrite");
            transaction.objectStore("posts").add({post_id: "p1", title: "old"});
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { connection.close(); }
    await expect(database.read(path)).rejects.toMatchObject({name: "VersionError", message: expect.stringContaining("Incompatible Local record format")});
    const callback = vi.fn(() => ({title: "changed"}));
    await expect(database.update(path, callback)).rejects.toMatchObject({name: "VersionError"});
    expect(callback).not.toHaveBeenCalled();
    expect(await readNativeStore("old-records", "posts")).toEqual([{_id: 1, post_id: "p1", title: "old"}]);
});

it("includes the original path when a nested address is ambiguous", async () => {
    const database = createLocalDatabase({storageId: "ambiguous-path"});
    const invalidPath = ["chats", {chat_id: "c1"}, {field: "title"}];
    await expect(database.read(invalidPath)).rejects.toMatchObject({
        code: "database/invalid-argument", message: expect.stringContaining(JSON.stringify(invalidPath))
    });
});
