import createService from "../../../../../src/__tests__/createService";
import LocalCursor from "../../local/cursor";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local/LocalBackend";
let sequence = 0;
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
async function setup() {
    const storageId = `wildcard-review-${++sequence}`;
    const backend = new LocalBackend({storageId});
    const database = createService(LocalDatabase, {storageId, backend});
    await database.read(["mutual"]);
    const rows = [
        ["a", "same", {uid: "u", id: "x", timestamp: 3}],
        ["a", "other", {uid: "v", id: "y", timestamp: 2}],
        ["b", "same", {uid: "u", id: "z", timestamp: 1}],
        ["b", "last", {uid: "v", id: "w", timestamp: 4}]
    ];
    await backend.request("database.update", "", new Map(rows.map(([type, id, value]) => [
        ["mutual", {mutual_type: type}, {mutual_id: id}], value
    ])));
    return {database, backend};
}
const pattern = ["mutual", "mutual_type", "mutual_id"];
it("filters leaves and preserves duplicate keys across pages and composition", async () => {
    const {database} = await setup();
    const cursor = database.cursor(pattern, {orderBy: "uid", equalTo: "u"});
    expect(await cursor.next()).toEqual([{key: "same", params: {mutual_type: "a"}, value: {uid: "u", id: "x", timestamp: 3}}]);
    expect(await cursor.next()).toEqual([{key: "same", params: {mutual_type: "b"}, value: {uid: "u", id: "z", timestamp: 1}}]);
    expect(await cursor.next()).toEqual([]);
    expect(cursor.position.finished).toBe(true);
    const composed = database.cursor([{path: pattern, orderBy: "uid", equalTo: "u"},
        {path: ["mutual", {mutual_type: "a"}, "mutual_id"], orderBy: "uid", equalTo: "u"}]);
    expect(await composed.next(10)).toHaveLength(2);
});
it("merges query order globally in both directions", async () => {
    const {database} = await setup();
    for (const order of ["asc", "desc"]) {
        const cursor = database.cursor(pattern, {orderBy: "id", order});
        const values = [];
        while (!cursor.position.finished) values.push(...await cursor.next(1));
        expect(values.map(e => e.value.id)).toEqual(order === "asc" ? ["w", "x", "y", "z"] : ["z", "y", "x", "w"]);
    }
});
it("delays handle until delivery and edits only the concrete branch", async () => {
    const {database} = await setup();
    const handle = vi.fn(({params, value}) => params.mutual_type === "a" ? {...value, edited: true} : null);
    const cursor = database.cursor(pattern, {orderBy: "uid", equalTo: "u", handle});
    expect(await cursor.next()).toMatchObject([{key: "same", params: {mutual_type: "a"}, value: {edited: true}}]);
    expect(handle).toHaveBeenCalledTimes(1);
    expect((await database.read(["mutual", {mutual_type: "b"}, {mutual_id: "same"}])).id).toBe("z");
    expect(await cursor.next(10)).toEqual([]);
    expect(await database.read(["mutual", {mutual_type: "b"}, {mutual_id: "same"}])).toBeUndefined();
});
it("rejects live wildcard subscriptions and duplicate capture names", async () => {
    const {database} = await setup();
    expect(() => database.cursor(pattern).subscribe(() => {})).toThrow(/Subscriptions/);
    expect(() => database.cursor(["mutual", "same", "same"])).toThrow(/distinct/);
});
it("keeps fixed variable segments and ordinary entry shapes", async () => {
    const {database} = await setup();
    const type = "a";
    const entries = await database.cursor(["mutual", {mutual_type: type}, "mutual_id"]).next(10);
    expect(entries).toHaveLength(2);
    expect(entries.every(e => !Object.hasOwn(e, "params"))).toBe(true);
});
it("supports multiple captures and a literal nested field", async () => {
    const {database, backend} = await setup();
    await backend.request("database.update", "", new Map([
        [["mutualstamps", {mutual_type: "a"}, {user_id: "u"}, {mutual_id: "r"}], "author"],
        [["mutualstamps", {mutual_type: "b"}, {user_id: "v"}, {mutual_id: "r"}], "author"]
    ]));
    const cursor = database.cursor(["mutualstamps", "mutual_type", "user_id", "mutual_id"], {equalTo: "author"});
    expect((await cursor.next(10)).map(({key, params}) => ({key, params}))).toEqual([
        {key: "r", params: {mutual_type: "a", user_id: "u"}}, {key: "r", params: {mutual_type: "b", user_id: "v"}}
    ]);
    await database.create(["posts", {post_id: "p"}], {edits: {e: {text: "A"}}});
    const nested = database.cursor(["posts", "post_id", {edits: "edits"}, "edit_id"]);
    expect(await nested.next(10)).toEqual([{key: "e", params: {post_id: "p"}, value: {text: "A"}}]);
});
it("handles empty branches and query bounds without leaving empty unfinished pages", async () => {
    const {database} = await setup();
    const cursor = database.cursor(pattern, {orderBy: "id", start: "x", end: "y"});
    expect((await cursor.next(10)).map(e => e.value.id)).toEqual(["x", "y"]);
    expect(await database.cursor(pattern, {orderBy: "uid", equalTo: "missing"}).next(10)).toEqual([]);
});

it("continues after handle removes the ordered field", {timeout: 2000}, async () => {
    const {database} = await setup();
    const handle = vi.fn(({params, value}) => params.mutual_type === "a" ? {id: value.id} : undefined);
    const cursor = database.cursor(pattern, {orderBy: "uid", equalTo: "u", handle});
    expect(await cursor.next(10)).toEqual([
        {key: "same", params: {mutual_type: "b"}, value: {uid: "u", id: "z", timestamp: 1}}
    ]);
    expect(handle).toHaveBeenCalledTimes(2);
    expect(cursor.position.finished).toBe(true);
    expect(await database.read(["mutual", {mutual_type: "a"}, {mutual_id: "same"}])).toEqual({id: "x"});
});

it("deduplicates nested wildcard and concrete sources using their public path and params", async () => {
    const {database} = await setup();
    const wildcard = database.cursor(pattern, {orderBy: "uid", equalTo: "u"});
    const concrete = database.cursor(["mutual", {mutual_type: "a"}, "mutual_id"], {orderBy: "uid", equalTo: "u"});
    const cursor = database.cursor([database.cursor([wildcard]), concrete]);
    const entries = [];
    while (!cursor.position.finished) entries.push(...await cursor.next(1));
    expect(entries).toHaveLength(2);
    expect(entries.map(entry => entry.params?.mutual_type).sort()).toEqual(["a", "b"]);
});

it("keeps the LocalCursor instance for intermediate wildcard paths", () => {
    const cursor = new LocalCursor("native-wildcard-identity", pattern);
    expect(cursor.constructor).toBe(LocalCursor);
    expect(cursor.path).toEqual(pattern);
});
