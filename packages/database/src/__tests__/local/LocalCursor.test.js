import createLocalDatabase from "../createLocalDatabase";
import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";

import {openDatabase} from "../../local/helpers";
import {discoverPostScenario} from "../common/discoverPostScenario";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const record = key => ["meta", {id: key, _: true}];
const seed = async (database, values) => {
    for (const [key, value] of Object.entries(values)) await database.update(record(key), () => value);
};
const readAll = async (cursor, size = 2) => {
    const result = [];
    while (!cursor.position.finished) {
        result.push(...await cursor.next(size));
        if (result.length > 100) throw new Error("Cursor did not finish.");
    }
    return result;
};

it("reads a newly published root post and finds it again after returning to Discover", async () => {
    await discoverPostScenario(createLocalDatabase({storageId: "discover-publish"}));
});

it("notifies the Discover cursor only for new root posts", async () => {
    const database = createLocalDatabase({storageId: "discover-posts"});
    await database.create(["posts", {post_id: "first"}], {to: 0, text: "first"});
    const cursor = database.cursor(["posts", "post_id"], {orderBy: ["to"], equalTo: 0, order: "desc"});
    const events = [];
    const subscription = cursor.subscribe(event => events.push(event));
    try {
        await database.create(["posts", {post_id: "reply"}], {to: "first"});
        await database.create(["posts", {post_id: "second"}], {to: 0, text: "second"});
        await vi.waitFor(() => expect(events).toEqual([
            {type: "add", entry: {key: "second", value: {to: 0, text: "second"}}}
        ]));
    } finally { subscription.unsubscribe(); }
});

it.each(["asc", "desc"])("pages equal values exactly once in %s order, including a deleted boundary", async order => {
    const db = createLocalDatabase({storageId: `pages-${order}`});
    await seed(db, Object.fromEntries(Array.from({length: 17}, (_, i) => [`k${String(i).padStart(2, "0")}`, {score: 1}])));
    const cursor = db.cursor("meta", {orderBy: "score", equalTo: 1, order});
    expect(cursor.position).toEqual({index: -1, key: undefined, finished: false});
    const first = await cursor.next(4);
    await db.delete(record(first.at(-1).key));
    const entries = [...first, ...await readAll(cursor, 3)];
    const keys = Array.from({length: 17}, (_, i) => `k${String(i).padStart(2, "0")}`);
    expect(entries.map(entry => entry.key)).toEqual(order === "asc" ? keys : keys.reverse());
    expect(cursor.position).toEqual({index: 16, key: entries.at(-1).key, finished: true});
    expect(cursor.count).toBe(17);
    expect(await cursor.next()).toEqual([]);
});

it("sorts integer keys and applies inclusive key, prefix and timestamp boundaries", async () => {
    const db = createLocalDatabase({storageId: "keys"});
    await seed(db, {10: 10, 2: 2, "02": 2, alpha: 1, alphabet: 1, beta: 1});
    expect((await readAll(db.cursor("meta"))).map(entry => entry.key)).toEqual(["2", "02", "10", "alpha", "alphabet", "beta"]);
    expect((await readAll(db.cursor("meta", {order: "desc", start: "alpha"}))).map(entry => entry.key))
        .toEqual(["alphabet", "alpha"]);
    expect((await readAll(db.cursor("meta", {start: "2", end: "10"}))).map(entry => entry.key)).toEqual(["2", "02", "10"]);
    const before = "before"; const inside = "inside"; const after = "after";
    await seed(db, {
        [before]: {score: 1, timestamp: 1000},
        [inside]: {score: 2, timestamp: 2000},
        [after]: {score: 3, timestamp: 3000}
    });
    expect((await readAll(db.cursor("meta", {orderBy: "score", startDate: new Date(2000), endDate: new Date(2000)})))
        .map(entry => entry.key)).toEqual([inside]);
});

it("filters missing fields, supports nested ordering and value equality", async () => {
    const db = createLocalDatabase({storageId: "fields"});
    await seed(db, {a: {nested: {name: "Alice"}}, b: {nested: {name: "Alina"}}, c: {nested: {name: "Bob"}}, d: {other: true}});
    expect((await readAll(db.cursor("meta", {orderBy: ["nested", "name"], start: "Al"}))).map(entry => entry.key))
        .toEqual(["a", "b"]);
    expect((await readAll(db.cursor("meta", {orderBy: "nested/name", order: "desc"}))).map(entry => entry.key))
        .toEqual(["c", "b", "a"]);
    await seed(db, {a: false, b: true, c: false});
    expect(await readAll(db.cursor("meta", {equalTo: false}))).toEqual([{key: "a", value: false}, {key: "c", value: false}]);
});

it("handles edits, deletes and replacements without returning a key twice", async () => {
    const db = createLocalDatabase({storageId: "handle"});
    await seed(db, {a: {n: 1}, b: {n: 2}, c: {n: 3}});
    const cursor = db.cursor("meta", {
        handle: ({key, value}) => {
            if (key === "a") { value.n = 99; return undefined; }
            if (key === "b") return null;
            return {n: 30};
        }
    });
    expect(await readAll(cursor)).toEqual([
        {key: "a", value: expect.objectContaining({n: 1})},
        {key: "c", value: expect.objectContaining({n: 30})}
    ]);
    expect(await db.read(record("b"))).toBeUndefined();
    expect(cursor.count).toBe(2);
});

it("suppresses the baseline and reports query membership transitions once", async () => {
    const db = createLocalDatabase({storageId: "events"});
    await seed(db, {a: {score: 1}, b: {score: 2}});
    const cursor = db.cursor("meta", {orderBy: "score", start: 2});
    const events = [];
    const sub = cursor.subscribe(event => events.push(event));
    await vi.waitFor(() => expect(sub.active).toBe(true));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(events).toEqual([]);
    await db.update(record("a"), () => ({score: 3}));
    await db.update(record("b"), () => ({score: 1}));
    await db.update(record("a"), () => ({score: 4}));
    await db.delete(record("a"));
    expect(events.map(event => [event.type, event.entry.key])).toEqual([
        ["add", "a"], ["remove", "b"], ["change", "a"], ["remove", "a"]
    ]);
    expect(sub).toMatchObject({added: 1, changed: 1, removed: 2});
    expect(cursor.count).toBe(-1);
    sub.unsubscribe();
    sub.unsubscribe();
    expect(sub.active).toBe(false);
});

it("finishes an empty collection and validates page size", async () => {
    const db = createLocalDatabase({storageId: "empty"});
    const cursor = db.cursor("meta", {group: "Records"});
    await expect(cursor.next(0)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await cursor.next(2)).toEqual([]);
    expect(cursor.position).toEqual({index: -1, key: undefined, finished: true});
    expect(await cursor.next()).toEqual([]);
});

it("does not replay a processed key moved later by a concurrent edit", async () => {
    const db = createLocalDatabase({storageId: "concurrent"});
    await seed(db, {a: {score: 1}, b: {score: 2}, c: {score: 3}});
    const cursor = db.cursor("meta", {orderBy: "score"});
    expect((await cursor.next()).map(entry => entry.key)).toEqual(["a"]);
    await db.update(record("a"), () => ({score: 4}));
    await db.update(record("d"), () => ({score: 2}));
    expect((await readAll(cursor)).map(entry => entry.key)).toEqual(["b", "d", "c"]);
});

it("keeps independent subscriptions and stops delivery after unsubscribe", async () => {
    const db = createLocalDatabase({storageId: "independent"});
    const cursor = db.cursor("meta");
    const first = vi.fn(); const second = vi.fn();
    const a = cursor.subscribe(first); const b = cursor.subscribe(second);
    await new Promise(resolve => setTimeout(resolve, 0));
    await db.update(record("a"), () => 1);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(cursor.count).toBe(2);
    a.unsubscribe();
    await db.delete(record("a"));
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
    expect(cursor.count).toBe(1);
    b.unsubscribe();
});

it("iterates root collections and observes a newly populated collection", async () => {
    const db = createLocalDatabase({storageId: "root"});
    await db.update(record("a"), () => 1);
    expect((await readAll(db.cursor([]))).map(entry => entry.key)).toEqual(["meta"]);
    const events = [];
    const sub = db.cursor([]).subscribe(event => events.push(event));
    await new Promise(resolve => setTimeout(resolve, 0));
    await db.update(["errors", {id: "b", _: true}], () => 2);
    expect(events.map(event => [event.type, event.entry.key])).toEqual([["add", "errors"]]);
    sub.unsubscribe();
});

it("replaces a child through its stored named identity", async () => {
    const db = createLocalDatabase({storageId: "named-handle"});
    const parent = ["meta", {settings: "settings"}];
    const path = [...parent, {setting_id: "theme"}];
    await db.update(path, () => ({label: "old"}));
    const cursor = db.cursor(parent, {handle: () => ({label: "new"})});
    expect(await cursor.next()).toEqual([{key: "theme", value: expect.objectContaining({label: "new"})}]);
    expect(await db.read(path)).toMatchObject({label: "new"});
});

it("selects the named identity from stored paths for pages and handler writes", async () => {
    const db = createLocalDatabase({storageId: "identity-index"});
    await db.update(["users_public", {user_id: "u2"}], () => ({name: "B", user_id: "wrong"}));
    await db.update(["users_public", {other_id: "x"}], () => ({name: "A"}));
    await db.update(["users_public", {user_id: "u1"}], () => ({name: "A"}));
    const cursor = db.cursor(["users_public", "user_id"], {
        orderBy: "name", handle: ({value}) => ({...value, changed: true})
    });
    expect(cursor.path).toBe("users_public");
    expect(await readAll(cursor, 1)).toEqual([
        {key: "u1", value: expect.objectContaining({changed: true})},
        {key: "u2", value: expect.objectContaining({user_id: "wrong", changed: true})}
    ]);
    expect(await db.read(["users_public", {other_id: "x"}])).toEqual({name: "A"});
    expect(await db.read(["users_public", {user_id: "u2"}])).toMatchObject({changed: true});
    expect((await readAll(db.cursor("users_public"))).map(entry => entry.key)).toEqual(["u1", "u2", "x"]);
});

it("filters named children in fallback scans and subscriptions, retaining nested values", async () => {
    const db = createLocalDatabase({storageId: "identity-fallback"});
    const parent = ["meta", {settings: "settings"}];
    await db.update([...parent, {user_id: "u2"}], () => ({profile: {name: "Bob"}}));
    await db.update([...parent, {other_id: "x"}], () => ({profile: {name: "Amy"}}));
    await db.update([...parent, {user_id: "u1"}], () => ({profile: {name: "Ann"}}));
    await db.update([...parent, {user_id: "u1"}, {detail_id: "d"}], () => ({extra: true}));
    const cursor = db.cursor([...parent, "user_id"], {orderBy: ["profile", "name"], start: "A"});
    expect(cursor.path).toBe("meta/settings");
    expect(await readAll(cursor)).toEqual([{key: "u1", value: {profile: {name: "Ann"}, d: {extra: true}}}]);
    const events = [];
    const sub = db.cursor([...parent, "user_id"]).subscribe(event => events.push(event));
    await new Promise(resolve => setTimeout(resolve, 0));
    await db.update([...parent, {other_id: "y"}], () => ({profile: {name: "Other"}}));
    await db.update([...parent, {user_id: "u3"}], () => ({profile: {name: "New"}}));
    expect(events).toEqual([{type: "add", entry: {key: "u3", value: {profile: {name: "New"}}}}]);
    sub.unsubscribe();
    expect((await readAll(db.cursor(parent))).map(entry => entry.key)).toEqual(["u1", "u2", "u3", "x", "y"]);
    await db.update(["meta", "literal", {setting_id: "theme"}], () => ({label: "exact"}));
    expect(await readAll(db.cursor("meta/literal"))).toEqual([{key: "theme", value: {label: "exact"}}]);
});

it.each(["asc", "desc"])("pages keys in %s order across deletion of a boundary", async order => {
    const db = createLocalDatabase({storageId: `native-keys-${order}`});
    await seed(db, {10: {created: 2}, 2: {created: 1}, "02": {created: 1}, z: {created: 2}});
    const cursor = db.cursor("meta", {order});
    const first = await cursor.next(2);
    expect(first.map(entry => entry.key)).toEqual(order === "asc" ? ["2", "02"] : ["z", "10"]);
    await db.delete(record(first.at(-1).key));
    const rest = await readAll(cursor, 1);
    expect([...first, ...rest].map(entry => entry.key)).toEqual(order === "asc"
        ? ["2", "02", "10", "z"]
        : ["z", "10", "02", "2"]);
    expect(await readAll(db.cursor("meta", {startDate: new Date(1000), endDate: new Date(2000)}))).toEqual([]);
});

it("orders by created with stable ties, inclusive bounds, and fresh values per page", async () => {
    const db = createLocalDatabase({storageId: "native-created"});
    await seed(db, {a: {created: 1}, b: {created: 2}, c: {created: 2}, d: {created: 3}});
    const cursor = db.cursor("meta", {orderBy: "created", start: 2, end: 3});
    expect((await cursor.next(1)).map(entry => entry.key)).toEqual(["b"]);
    await db.update(record("a"), () => ({created: 2}));
    await db.update(record("b"), () => ({created: 4}));
    expect((await readAll(cursor, 1)).map(entry => entry.key)).toEqual(["c", "d"]);
    expect((await readAll(db.cursor("meta", {orderBy: "created", equalTo: 2, order: "desc"})))
        .map(entry => entry.key)).toEqual(["c", "a"]);
});

it("writes handler replacements by their exact stored identity", async () => {
    const db = createLocalDatabase({storageId: "native-handle"});
    await seed(db, {a: {created: 1}, b: {created: 2}});
    const cursor = db.cursor("meta", {orderBy: "created", handle: ({value}) => ({created: value.created < 10 ? value.created + 10 : value.created})});
    expect((await readAll(cursor)).map(entry => entry.value.created)).toEqual([11, 12]);
    expect(await db.read(record("a"))).toMatchObject({created: 11});
    await db.update(["posts", {post_id: "p1"}], () => ({created: 1}));
    expect(await readAll(db.cursor("posts", {handle: () => ({created: 3})})))
        .toEqual([{key: "p1", value: expect.objectContaining({created: 3})}]);
    expect(await db.read(["posts", {post_id: "p1"}])).toMatchObject({created: 3});
});

it("orders nested records, undeclared fields and object values consistently", async () => {
    const db = createLocalDatabase({storageId: "native-fallback"});
    const parent = ["meta", {settings: "settings"}];
    await db.update([...parent, {setting_id: "theme"}], () => ({created: 2, label: "z"}));
    await db.update([...parent, {setting_id: "locale"}], () => ({created: 1, label: "a"}));
    expect((await readAll(db.cursor(parent, {orderBy: "created"}))).map(entry => entry.key))
        .toEqual(["locale", "theme"]);
    await seed(db, {a: {label: "z"}, b: {label: "a"}});
    expect((await readAll(db.cursor("meta", {orderBy: "label"}))).map(entry => entry.key))
        .toEqual(["b", "a"]);
    await seed(db, {c: {created: {value: 1}}, d: {created: 2}});
    expect((await readAll(db.cursor("meta", {orderBy: "created"}))).map(entry => entry.key))
        .toEqual(["d", "c"]);
    expect(await readAll(db.cursor("meta", {start: "z", end: "a"}))).toEqual([]);
});

it.each([3, 4])("rejects an existing version-%i database until it is deleted", async version => {
    const request = indexedDB.open(`old-${version}`, version);
    request.onupgradeneeded = () => request.result.createObjectStore("meta", {keyPath: ["_collection", "_key"]});
    const old = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    old.close();
    await expect(openDatabase(`old-${version}`)).rejects.toMatchObject({name: "VersionError"});
});
