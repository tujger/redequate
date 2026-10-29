import {IDBFactory, IDBDatabase, IDBObjectStore} from "fake-indexeddb";
import createLocalDatabase, {readNativeStore} from "../../../database/src/__tests__/createLocalDatabase";
import LocalBackend from "../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const post = ["posts", {post_id: "p1"}];
const setup = async (storageId = "backend-update", stores) => {
    const database = createLocalDatabase({storageId, stores});
    await database.read(["posts"]);
    const backend = new LocalBackend({storageId});
    const request = (...args) => backend.request("database.update", ...args);
    const read = path => request(path, null, {mode: "read"});
    const replace = (path, value, etag) => request(path, value, {mode: "replace", etag});
    return {database, backend, request, read, replace};
};

it("patches nested values and deletes supplied children without invoking LocalDatabase.update", async () => {
    const {database, request} = await setup();
    await database.create(post, {text: "old", keep: true, obsolete: true, nested: {a: 1}});
    const update = vi.spyOn(database, "update").mockImplementation(() => { throw new Error("recursive update"); });
    expect(await request(post, {text: "new", obsolete: null, "nested/b": false})).toBeNull();
    expect(await database.read(post)).toEqual({text: "new", keep: true, nested: {a: 1, b: false}});
    expect(update).not.toHaveBeenCalled();
    expect((await readNativeStore("backend-update", "posts"))[0]).toMatchObject({
        _id: 1, post_id: "p1", text: "new", keep: true, nested: {a: 1, b: false}
    });
});

it("patches collections, scoped compound paths, and unindexed singleton fields", async () => {
    const {database, request} = await setup();
    const scope = ["chats", {chat_id: "c1"}];
    await request(["posts"], {p1: {title: "A"}, p2: {title: "B"}});
    await request(scope, {m1: {text: "A"}, "m2/text": "B"});
    await request(["chats", {chat_id: "c2"}], {m1: {text: "Other"}});
    await request(scope, {"m1/text": "Changed", m2: null});
    expect(await database.read([...scope, "message_id"])).toEqual({m1: {text: "Changed"}});
    expect(await database.read(["chats", {chat_id: "c2"}, {message_id: "m1"}])).toEqual({text: "Other"});
    await request(["meta"], {maintenance: false, "settings/theme": "dark"});
    expect(await database.read(["meta"])).toEqual({maintenance: false, settings: {theme: "dark"}});
    await request(["posts"], {p1: null});
    expect(await database.read(["posts"])).toEqual({p2: {title: "B"}});
});

it("supports root objects and Maps of named Local paths in atomic multi-store patches", async () => {
    const {database, request} = await setup();
    await request("", {"posts/p1/title": "Original", "meta/maintenance": true});
    await request([], new Map([
        [[...post, {title: "title"}], "Changed"],
        [["users_private", {user_id: "u"}, {device_id: "phone"}], {locale: "en"}],
        [["roles", {user_id: "u"}], "admin"],
        [["meta", "maintenance"], false]
    ]));
    expect(await database.read(post)).toEqual({title: "Changed"});
    expect(await database.read(["roles", {user_id: "u"}])).toBe("admin");
    expect(await database.read(["users_private", {user_id: "u"}])).toEqual({phone: {locale: "en"}});
    expect(await database.read(["meta"])).toEqual({maintenance: false});
});

it("resolves timestamp and increment markers once per committed batch", async () => {
    const {database, backend, request} = await setup();
    expect(database.TIMESTAMP).toBe(backend.TIMESTAMP);
    await request(post, {count: 2});
    await request("", new Map([
        [[...post, "count"], backend.increment(3)],
        [[...post, "time"], backend.TIMESTAMP],
        [["meta", "time"], database.TIMESTAMP]
    ]));
    const result = await database.read(post);
    expect(result).toEqual({count: 5, time: expect.any(Number)});
    expect((await database.read(["meta"])).time).toBe(result.time);
});

it("resolves nested increments and reuses one marker across fields and writes", async () => {
    const {database, backend, request} = await setup("backend-reused-increment");
    await database.create(post, {nested: {left: 1, right: [3]}});
    const marker = backend.increment(2);
    const changes = {nested: {left: marker, right: [marker]}};
    await request(post, changes);
    expect(await database.read(post)).toEqual({nested: {left: 3, right: [5]}});
    await request(post, changes);
    expect(await database.read(post)).toEqual({nested: {left: 5, right: [7]}});
    await request("", new Map([
        [[...post, "nested", "left"], marker],
        [["meta", "count"], marker]
    ]));
    expect(await database.read(post)).toEqual({nested: {left: 7, right: [7]}});
    expect(await database.read(["meta"])).toEqual({count: 2});
});

it("rejects malformed symbol values without changing a stored record", async () => {
    const {database, backend, request} = await setup("backend-invalid-increment");
    await request(post, {count: 4, keep: true});
    const marker = backend.increment(2);
    await expect(request(post, marker, {mode: "patch"})).rejects.toMatchObject({code: "database/invalid-argument"});
    const [key] = Object.getOwnPropertySymbols(marker);
    for (const invalid of [{[key]: Infinity}, {[key]: "2"}, {[Symbol("other")]: 2}]) {
        await expect(request(post, {count: marker, keep: invalid})).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(await database.read(post)).toEqual({count: 4, keep: true});
    }
});

it("reads missing values and conditionally creates, replaces, and deletes them", async () => {
    const {database, read, replace} = await setup();
    const missing = await read(post);
    expect(missing).toEqual({value: null, etag: expect.any(String)});
    expect(await replace(post, false, missing.etag)).toEqual({committed: true, value: false});
    const first = await read(post);
    expect(await replace(post, [1, false], first.etag)).toEqual({committed: true, value: [1, false]});
    const second = await read(post);
    expect(await replace(post, null, second.etag)).toEqual({committed: true, value: null});
    expect(await database.read(post)).toBeUndefined();
    expect((await read(post)).etag).toBe(missing.etag);
});

it("returns fresh snapshots on a conflict and permits retry without executing callbacks", async () => {
    const {database, request, read, replace} = await setup();
    await request(post, {count: 1});
    const snapshot = await read(post);
    await request(post, {count: 2});
    const conflict = await replace(post, {count: 99}, snapshot.etag);
    expect(conflict).toEqual({committed: false, value: {count: 2}, etag: expect.any(String)});
    expect(await database.read(post)).toEqual({count: 2});
    expect(await replace(post, {count: conflict.value.count + 1}, conflict.etag)).toEqual({committed: true, value: {count: 3}});
    const callback = vi.fn(() => ({count: 9}));
    await expect(replace(post, callback, conflict.etag)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(callback).not.toHaveBeenCalled();
});

it("serializes competing replacements so only one writer commits a shared snapshot", async () => {
    const {database, read, replace} = await setup();
    const snapshot = await read(post);
    const outcomes = await Promise.all([replace(post, 1, snapshot.etag), replace(post, 2, snapshot.etag)]);
    expect(outcomes.filter(result => result.committed)).toHaveLength(1);
    const winner = outcomes.find(result => result.committed);
    const conflict = outcomes.find(result => !result.committed);
    expect(conflict.value).toBe(winner.value);
    expect(await database.read(post)).toBe(winner.value);
    expect(await replace(post, 3, conflict.etag)).toEqual({committed: true, value: 3});
});

it("uses deterministic, type-sensitive ETags and excludes explicit service keys", async () => {
    const {read, replace} = await setup();
    const first = await read(post);
    const value = {_id: "user", post_id: "p1", nested: {b: 2, a: 1}};
    await replace(post, value, first.etag);
    const saved = await read(post);
    expect(saved.value).toEqual({nested: {b: 2, a: 1}});
    await replace(post, {...value, nested: {a: 1, b: 2}}, saved.etag);
    expect((await read(post)).etag).toBe(saved.etag);
    await replace(post, [1], saved.etag);
    const array = await read(post);
    await replace(post, {0: 1}, array.etag);
    expect((await read(post)).etag).not.toBe(array.etag);
});

it("conditionally replaces a collection and returns resolved values for nested markers", async () => {
    const {database, backend, request, read, replace} = await setup();
    await request(["posts"], {p1: {count: 1}, p2: {count: 2}});
    const snapshot = await read(["posts"]);
    expect(await replace(["posts"], {p3: {time: database.TIMESTAMP}}, snapshot.etag)).toEqual({
        committed: true, value: {p3: {time: expect.any(Number)}}
    });
    const field = [...post, {field: "count"}];
    const missing = await read(field);
    expect(await replace(field, backend.increment(2), missing.etag)).toEqual({committed: true, value: 2});
});

it("rejects overlapping paths and preserves the whole batch on unique-index failure", async () => {
    const audit = {store: "audit", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: [
        {name: "id", keypath: "id", options: {unique: true}}, {name: "code", keypath: "code", options: {unique: true}}
    ]};
    const {database, request} = await setup("update-rollback", [audit]);
    await request("", new Map([[post, {title: "old"}], [["audit", {id: "a"}], {code: "unique"}]]));
    await expect(request(post, {nested: {}, "nested/child": true})).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(request("", new Map([[post, {title: "new"}], [[...post, "title"], "overlap"]])))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(request("", new Map([[post, {title: "new"}], [["audit", {id: "b"}], {code: "unique"}]])))
        .rejects.toMatchObject({name: "ConstraintError"});
    expect(await database.read(post)).toEqual({title: "old"});
    expect(await database.read(["audit", {id: "b"}])).toBeUndefined();
});

it("delivers one committed snapshot and decoded child events, without read, conflict or abort notifications", async () => {
    const {database, request, read, replace} = await setup();
    const onChange = vi.fn(), added = vi.fn(), changed = vi.fn(), removed = vi.fn();
    const listener = database.addEventListener(["posts"], {onChange, onChildAdd: added, onChildChange: changed, onChildRemove: removed});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        const initial = await read(post);
        await request(post, {title: "A"});
        expect(added).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {title: "A"}});
        const snapshot = await read(post);
        await replace(post, {title: "B"}, snapshot.etag);
        expect(changed).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {title: "B"}});
        await replace(post, {title: "stale"}, initial.etag);
        await expect(request(post, {nested: 1, "nested/child": 2})).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(onChange).toHaveBeenCalledTimes(3);
        const beforeDelete = await read(post);
        await replace(post, null, beforeDelete.etag);
        expect(removed).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {title: "B"}});
        expect(onChange).toHaveBeenCalledTimes(4);
    } finally { listener.remove(); }
});

it("closes connections on reads, commits, conflicts and native write errors", async () => {
    const {request, read, replace} = await setup();
    const close = vi.spyOn(IDBDatabase.prototype, "close");
    const missing = await read(post);
    await request(post, {title: "A"});
    await replace(post, {title: "conflict"}, missing.etag);
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => { throw new Error("write failed"); });
    await expect(request(post, {title: "failed"})).rejects.toThrow("write failed");
    put.mockRestore();
    await expect(request(["unknown"], {item: 1})).rejects.toMatchObject({name: "NotFoundError"});
    expect(close).toHaveBeenCalledTimes(5);
});

it("validates modes, values and paths without initializing stores or invoking callbacks", async () => {
    const {backend, request} = await setup();
    const callback = vi.fn(() => ({}));
    for (const args of [[], [post], [post, {}, {}, {}], [post, {}, null], [post, {}, []], [post, {}, {mode: "bad"}],
        [post, false], [post, []], [post, callback, {}], [post, {bad: callback}], [post, {bad: undefined}],
        [post, {bad: Promise.resolve(1)}], [post, null, {mode: "replace"}], [post, {}, {mode: "read"}],
        [post, null, {mode: "replace", etag: "\n"}], ["", null, {mode: "read"}], [[], {}, {mode: "replace", etag: "x"}],
        ["", new Map([[["$auth", {id: "a"}], true]])], [post, {"/": 1}], ["", {"": 1}]]) {
        await expect(request(...args)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    const circular = {}; circular.self = circular;
    await expect(request(post, circular)).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(request(post, Promise.reject(new Error("async patch"))))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(request(post, Promise.reject(new Error("async replace")), {mode: "replace", etag: "x"}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(callback).not.toHaveBeenCalled();
    await expect(new LocalBackend({storageId: "unprepared"}).request("database.update", post, {}))
        .rejects.toMatchObject({name: "NotFoundError"});
    const open = vi.spyOn(globalThis.indexedDB, "open");
    expect(await request("", {})).toBeNull();
    expect(await request([], new Map())).toBeNull();
    expect(open).not.toHaveBeenCalled();
    expect(backend).toBeInstanceOf(LocalBackend);
});

// Storage and delivery tests isolate application reactions; their effects have integration coverage.
vi.mock("../common", () => ({handlers: {}}));


it("resolves nested and reused timestamp markers while leaving Firebase-shaped objects as ordinary data", async () => {
    const {database, backend, request} = await setup("timestamp-symbol");
    const marker = backend.TIMESTAMP;
    const firebaseValue = {".sv": "timestamp"};
    await request(post, {first: marker, nested: {second: marker}, firebaseValue});
    const saved = await database.read(post);
    expect(saved).toEqual({first: expect.any(Number), nested: {second: expect.any(Number)}, firebaseValue});
    expect(saved.first).toBe(saved.nested.second);
    expect(Object.getOwnPropertySymbols(saved)).toEqual([]);
    const field = [...post, {field: "last"}];
    const current = await backend.request("database.update", field, null, {mode: "read"});
    expect(await backend.request("database.update", field, marker, {mode: "replace", etag: current.etag}))
        .toEqual({committed: true, value: expect.any(Number)});
});


it("writes a timestamp directly to a missing or existing field, preserving siblings", async () => {
    const {database, backend, request} = await setup("direct-timestamp");
    await request(["_activity", "types"], {other: 7});
    const path = ["_activity", "types", "service"];
    const first = await request(path, backend.TIMESTAMP);
    expect(first).toEqual(expect.any(Number));
    expect(await database.read(["_activity", "types"])).toEqual({other: 7, service: first});
    await request(path, {old: true});
    const second = await request(path, backend.TIMESTAMP);
    expect(second).toEqual(expect.any(Number));
    expect(await database.read(["_activity", "types"])).toEqual({other: 7, service: second});
});

it("logs the original patch value instead of undefined", async () => {
    const {request} = await setup("patch-log");
    const log = vi.spyOn(console, "debug").mockImplementation(() => {});
    const changes = {service: 42};
    await request(["_activity", "types"], changes);
    expect(log).toHaveBeenCalledWith("[Backend:Update]", "update [_activity/types]", {value: changes});
});

it("validates explicit timestamp mode and rejects timestamps as patches", async () => {
    const {database, backend, request} = await setup("timestamp-mode");
    const path = ["_activity", "types", "service"];
    for (const value of [undefined, null, 123, {}, {".sv": "timestamp"}]) {
        await expect(request(path, value, {mode: "timestamp"})).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    await expect(request(path, backend.TIMESTAMP, {mode: "patch"})).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(request("", backend.TIMESTAMP)).rejects.toMatchObject({code: "database/invalid-argument"});
    await request(path, backend.TIMESTAMP, {mode: "timestamp"});
    expect(await database.read(path)).toEqual(expect.any(Number));
});
