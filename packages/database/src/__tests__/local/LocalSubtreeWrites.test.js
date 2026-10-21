import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const parent = ["posts", {post_id: "p1"}];
const child = [...parent, "edit", {edit_id: "e1"}];
const sibling = [...parent, "edit", {edit_id: "e2"}];
const other = ["posts", {post_id: "p10"}];
const created = value => value;
const seed = async database => {
    await database.update(parent, () => ({text: "old", kept: true}));
    await database.update(child, () => (({uid: "alice"})));
    await database.update(sibling, () => ( {uid: "bob"}));
    await database.update(other, () => ( {text: "unrelated"}));
};

it.each([[parent], [[...parent, "edit"]], [["posts"]]])("deletes a path and all of its descendants: %j", async path => {
    const database = new LocalDatabase({storageKey: "delete-tree"});
    await seed(database);
    await database.delete(path);
    expect(await database.read(child)).toBeUndefined();
    expect(await database.read(sibling)).toBeUndefined();
    if (path.length > 1) expect(await database.read(other)).toEqual(created({text: "unrelated"}));
    if (path === parent) expect(await database.readSubtree(parent)).toBeUndefined();
});
it("deletes child rows even when the parent row is absent", async () => {
    const database = new LocalDatabase({storageKey: "orphan"});
    await database.update(child, () => ({uid: "alice"}));
    await database.delete(parent);
    expect(await database.read(child)).toBeUndefined();
    expect(await database.readSubtree(parent)).toBeUndefined();
});
it.each(["write", "batch"])("replaces a record subtree through %s and preserves explicit named children", async mode => {
    const database = new LocalDatabase({storageKey: "replace-tree"});
    await seed(database);
    const value = {text: "new", edit: {e1: {uid: "changed"}}};
    if (mode === "write") await database.update(parent, () => value);
    else await database.update(new Map([[parent, value]]));
    expect(await database.read(child)).toEqual(created({uid: "changed"}));
    expect(await database.read(sibling)).toBeUndefined();
    expect(await database.read(parent)).toEqual(created({text: "new", edit: {e1: created({uid: "changed"})}}));
    expect(await database.read(other)).toEqual(created({text: "unrelated"}));
    await database.update(parent, () => ({text: "flat"}));
    expect(await database.read(child)).toBeUndefined();
    expect(await database.readSubtree(parent)).toEqual(created({text: "flat"}));
});
it("replaces only supplied update fields and their descendants", async () => {
    const database = new LocalDatabase({storageKey: "update-fields"});
    await seed(database);
    await database.update(parent, {text: "new"});
    expect(await database.read(child)).toEqual(created({uid: "alice"}));
    await database.update(parent, {edit: {e1: {uid: "changed"}}});
    expect(await database.read(child)).toEqual(created({uid: "changed"}));
    expect(await database.read(sibling)).toBeUndefined();
    expect(await database.read(parent)).toEqual(created({text: "new", kept: true, edit: {e1: created({uid: "changed"})}}));
    await database.update(parent, {edit: null});
    expect(await database.read(child)).toBeUndefined();
    expect(await database.read(parent)).toEqual(created({text: "new", kept: true}));
});
it("keeps ordinary nested JSON inline regardless of the write entry point", async () => {
    const direct = new LocalDatabase({storageKey: "direct"}), collection = new LocalDatabase({storageKey: "collection"});
    const value = {text: "post", details: {child: {name: "value"}}};
    await direct.update(parent, () => value);
    await collection.update(["posts"], () => ({p1: value}));
    expect(await direct.read(parent)).toEqual(created(value));
    expect(await collection.read(parent)).toEqual(created({text: "post", details: {child: created({name: "value"})}}));
    expect(await collection.read([...parent, {"details": "details"}])).toEqual({child: created({name: "value"})});
});
it("omits unspecified timestamps and resolves increments when replacing a collection", async () => {
    const database = new LocalDatabase({storageKey: "collection-markers"});
    await database.update(parent, () => ({count: 3, timestamp: 123}));
    await database.update(child, () => ({count: 4, timestamp: 456}));
    await database.update(["posts"], () => ({p1: {count: database.increment(2), edit: {e1: {count: database.increment(3)}}}}));
    expect(await database.read(parent)).toEqual({count: 5, edit: {e1: {count: 7}}});
    expect(await database.read(child)).toEqual({count: 7});
});
it("preserves explicit grandchildren and removes omitted branches", async () => {
    const database = new LocalDatabase({storageKey: "grandchildren"});
    const first = [...child, "details", {detail_id: "d1"}];
    const second = [...child, "details", {detail_id: "d2"}];
    await seed(database);
    await database.update(first, () => ({text: "old"}));
    await database.update(second, () => ({text: "omitted"}));
    await database.update(parent, () => ({edit: {e1: {details: {d1: {text: "new"}}}}}));
    expect(await database.read(first)).toEqual(created({text: "new"}));
    expect(await database.read(second)).toBeUndefined();
    expect(await database.read(sibling)).toBeUndefined();
});
it.each([
    [parent, child],
    [[...parent, "edit"], child],
    ["posts/p1", child],
    [[{type: "posts"}, {post_id: "p1"}], parent],
    [["posts"], child]
])("rejects overlapping addresses before applying a cross-store batch: %j %j", async (first, second) => {
    const database = new LocalDatabase({storageKey: "overlap"});
    await seed(database);
    const notify = vi.fn();
    const listener = database.addEventListener(parent, {onChange: notify});
    try {
        await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce());
        await expect(database.update(new Map([
            [["users_public", {user_id: "u1"}], {name: "new"}],
            [first, {text: "first"}], [second, {text: "second"}]
        ]))).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(await database.read(parent)).toEqual(created({text: "old", kept: true,
            edit: {e1: created({uid: "alice"}), e2: created({uid: "bob"})}}));
        expect(await database.read(["users_public", {user_id: "u1"}])).toBeUndefined();
        expect(notify).toHaveBeenCalledOnce();
    } finally { listener.remove(); }
});
it("allows independent fields and collections while retaining callback replacement behavior", async () => {
    const database = new LocalDatabase({storageKey: "independent"});
    await seed(database);
    await database.update(new Map([[[...parent, "text"], "new"], [[...parent, "kept"], false],
        [["replies", {post_id: "p1"}], {text: "reply"}]]));
    expect(await database.read(parent)).toEqual(created({text: "new", kept: false,
        edit: {e1: created({uid: "alice"}), e2: created({uid: "bob"})}}));
    expect(await database.read(child)).toEqual(created({uid: "alice"}));
    await database.update(parent, value => value);
    expect(await database.read(child)).toEqual(created({uid: "alice"}));
    expect(await database.readSubtree(parent)).toMatchObject({edit: {e1: {uid: "alice"}, e2: {uid: "bob"}}});
});
