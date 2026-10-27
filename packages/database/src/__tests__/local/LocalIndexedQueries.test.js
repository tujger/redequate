import {IDBFactory, IDBIndex} from "fake-indexeddb";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const setup = async () => {
    const database = new LocalDatabase({storageId: "native-queries", backend: new LocalBackend({storageId: "native-queries"})});
    await database.read(["posts"]);
    for (const [post_id, uid, to] of [["p1", "a", 1], ["p2", "b", 2], ["p3", "a", 3]]) {
        await database.create(["posts", {post_id}], {uid, to});
    }
    return database;
};

it("uses a declared simple index for exact matches and bounds", async () => {
    const database = await setup();
    const indexes = [];
    const getAll = IDBIndex.prototype.getAll;
    vi.spyOn(IDBIndex.prototype, "getAll").mockImplementation(function (...args) {
        indexes.push(this.name);
        return getAll.apply(this, args);
    });
    expect(Object.keys(await database.read(["posts"], {orderBy: "uid", equalTo: "a"}))).toEqual(["p1", "p3"]);
    expect(indexes).toContain("uid");
    expect(Object.keys(await database.read(["posts"], {orderBy: "to", start: 2, end: 3, order: "desc"}))).toEqual(["p3", "p2"]);
    expect(indexes).toContain("to");
});

it("uses a compound index for a scoped range without scanning other scopes", async () => {
    const database = await setup();
    for (const [chat_id, message_id, created] of [["c1", "m1", 1], ["c1", "m2", 3], ["c2", "m3", 2]]) {
        await database.create(["chats", {chat_id}, {message_id}], {created});
    }
    const indexes = [];
    const getAll = IDBIndex.prototype.getAll;
    vi.spyOn(IDBIndex.prototype, "getAll").mockImplementation(function (...args) {
        indexes.push(this.name);
        return getAll.apply(this, args);
    });
    const rows = await database.read(["chats", {chat_id: "c1"}, "message_id"], {orderBy: "created", start: 2, end: 4});
    expect(Object.keys(rows)).toEqual(["m2"]);
    expect(indexes).toEqual(["chat_id_created"]);
});

it("rejects queries without an index and ambiguous string addresses", async () => {
    const database = await setup();
    await expect(database.read(["posts", {title: "title"}])).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.read(["posts"], {orderBy: "unknown", equalTo: "a"})).rejects.toMatchObject({code: "database/invalid-argument"});
    expect((await database.read("posts/p1")).post_id).toBe("p1");
    expect(await database.read("posts/p1/uid")).toBe("a");
});

it("updates independent properties in a batch and replaces collection rows using their unique field", async () => {
    const database = await setup();
    await database.update(new Map([
        [["posts", {post_id: "p1"}, "uid"], "changed"],
        [["posts", {post_id: "p1"}, "to"], 10]
    ]));
    expect(await database.read("posts/p1")).toMatchObject({uid: "changed", to: 10});
    await database.update(["posts"], () => ({p4: {uid: "d"}}));
    expect(await database.read("posts/p1")).toBeUndefined();
    expect(await database.read("posts/p4")).toMatchObject({post_id: "p4", uid: "d"});
    await database.delete(["posts"]);
    expect(await database.read(["posts"])).toBeUndefined();
});

it("addresses records by a non-unique declared index only when the result is unambiguous", async () => {
    const database = await setup();
    await database.update(["_counters", {gid: "group"}, {id: "one"}], {total: 1});
    await database.update(["_counters", {gid: "group"}, {id: "two"}], {total: 2});
    expect(await database.read(["_counters", {gid: "group"}, {id: "one"}])).toMatchObject({gid: "group", id: "one", total: 1});
    expect(Object.keys(await database.read(["_counters", {gid: "group"}, "id"]))).toEqual(["one", "two"]);
    await expect(database.read(["_counters", {gid: "group"}])).rejects.toMatchObject({code: "database/invalid-argument"});
});
