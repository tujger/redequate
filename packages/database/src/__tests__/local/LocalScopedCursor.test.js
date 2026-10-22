import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {openDatabase} from "../../local/helpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const pages = async (cursor, size = 1) => {
    const result = [];
    while (!cursor.position.finished) {
        result.push(...await cursor.next(size));
        if (result.length > 20) throw new Error("Cursor did not finish");
    }
    return result;
};

it.each([
    ["chats", "chat_id", "message_id", "created"],
    ["_chats", "user_id", "chat_id", "timestamp"],
    ["alerts", "user_id", "id", "timestamp"]
])("pages %s by scoped %s in both directions", async (root, parentField, childField, field) => {
    const db = new LocalDatabase({storageKey: `scope-${root}`});
    const parent = [root, {[parentField]: "owner"}];
    for (const [key, value] of [["10", 2], ["2", 1], ["02", 1], ["z", 3]]) {
        await db.update([...parent, {[childField]: key}], () => ({[field]: value}));
        await db.update([root, {[parentField]: "other"}, {[childField]: key}], () => ({[field]: -1}));
    }
    for (const order of ["asc", "desc"]) {
        const cursor = db.cursor(parent, {orderBy: field, order, start: 1, end: 2});
        const first = await cursor.next(1);
        const rest = await pages(cursor);
        expect([...first, ...rest].map(item => item.key)).toEqual(order === "asc"
            ? ["2", "02", "10"]
            : ["10", "02", "2"]);
    }
    expect(await db.read([...parent, {[childField]: "2"}])).toMatchObject({[field]: 1});
    const connection = await openDatabase(`scope-${root}`);
    expect(connection.objectStoreNames.contains(root)).toBe(true);
    connection.close();
});

it.each(["posts", "replies"])("filters %s by recipient and orders by child key", async root => {
    const db = new LocalDatabase({storageKey: `recipient-${root}`});
    for (const [key, to] of [["10", "u"], ["2", "u"], ["02", "u"], ["x", "other"]]) {
        await db.update([root, {post_id: key}], () => ({to}));
    }
    expect((await pages(db.cursor([root], {orderBy: "to", equalTo: "u"}))).map(item => item.key))
        .toEqual(["2", "02", "10"]);
});

it("resumes scoped key pages after deletion and writes handlers by the exact nested identity", async () => {
    const db = new LocalDatabase({storageKey: "scoped-handler"});
    const path = ["alerts", {user_id: "u1"}];
    for (const key of ["2", "02", "10", "z"]) {
        await db.update([...path, {id: key}], () => ({message: key}));
    }
    const cursor = db.cursor(path, {
        order: "desc",
        start: "2",
        end: "z",
        handle: ({key, value}) =>
            key === "10" ? {...value, message: "updated"} : undefined
    });
    const first = await cursor.next(1);
    await db.delete([...path, {id: first[0].key}]);
    expect([...first, ...await pages(cursor)].map(item => item.key)).toEqual(["z", "10", "02", "2"]);
    expect(await db.read([...path, {id: "10"}])).toMatchObject({message: "updated"});
    expect(await db.read(["alerts", {user_id: "other"}, {id: "10"}])).toBeUndefined();
});

it.each(["mutual", "mutualrequests"])("filters %s within a dynamic type scope", async root => {
    const db = new LocalDatabase({storageKey: `mutual-scope-${root}`});
    const parent = [root, {typeId: "watching", _: true}];
    await db.update([...parent, {mutual_id: "a", _: 1}], () => ({id: "u1", uid: "u2"}));
    await db.update([...parent, {mutual_id: "b", _: 1}], () => ({id: "u2", uid: "u1"}));
    await db.update([root, {typeId: "likes", _: true}, {mutual_id: "c", _: 1}], () => ({id: "u1"}));
    expect(await pages(db.cursor(parent, {orderBy: "id", equalTo: "u1"})))
        .toEqual([{key: "a", value: expect.objectContaining({id: "u1"})}]);
    expect(await pages(db.cursor(parent, {orderBy: "uid", equalTo: "u1"})))
        .toEqual([{key: "b", value: expect.objectContaining({uid: "u1"})}]);
});

it.each([
    ["users_public", "visit"], ["users_public", "emailVerified"], ["users_public", "name"],
    ["users_public", "email"], ["users_public", "_sort_name"],
    ["tag", "id"], ["tag", "label"], ["tag", "hidden"], ["tag", "uid"], ["tag", "_sort_name"],
    ["activity", "type"], ["activity", "uid"], ["errors", "uid"], ["extra", "id"], ["extra", "id_uid"]
])("matches direct and nested field ordering for active %s/%s queries", async (root, field) => {
    const db = new LocalDatabase({storageKey: `active-${root}-${field}`});
    const path = [root];
    for (const [key, value] of [["missing", undefined], ["null", null], ["2", false], ["02", false],
        ["10", true], ["n", 2], ["s", "2"]]) {
        await db.update([...path, {record_id: key}], () => ({
            marker: key,
            ...(value === undefined ? {} : {[field]: value, nested: {sort: value}})
        }));
    }
    for (const order of ["asc", "desc"]) {
        const direct = await pages(db.cursor(path, {orderBy: field, order}));
        vi.restoreAllMocks();
        const fallback = await pages(db.cursor(path, {orderBy: "nested/sort", order}));
        expect(direct).toEqual(fallback);
    }
});

it.each([["mutual", "uid_id"], ["mutualrequests", "uid_id"], ["_chats", "private"]])(
    "filters active scoped %s/%s queries", async (root, field) => {
        const db = new LocalDatabase({storageKey: `active-scoped-${root}`});
        const path = [root, {owner: "u"}];
        for (const key of ["2", "02", "10"]) {
            await db.update([...path, {record_id: key}], () => ({[field]: "match"}));
        }
        expect((await pages(db.cursor(path, {orderBy: field, equalTo: "match"}))).map(entry => entry.key))
            .toEqual(["2", "02", "10"]);
    });

it("continues when a sort value changes from a scalar to an object", async () => {
    const db = new LocalDatabase({storageKey: "index-to-fallback"});
    const record = id => ["meta", {id}];
    for (const [id, created] of [["a", 1], ["b", 2], ["c", 3]]) await db.update(record(id), () => ({created}));
    const cursor = db.cursor(["meta"], {orderBy: "created"});
    expect((await cursor.next(1)).map(entry => entry.key)).toEqual(["a"]);
    await db.update(record("b"), () => ({created: [1]}));
    expect((await pages(cursor)).map(entry => entry.key)).toEqual(["c", "b"]);
});
