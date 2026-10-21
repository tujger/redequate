import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {getAllRecords, getRecordsByType, parseDatabasePath} from "../../local/helpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const created = value => value;

it.each(["posts", "replies"])("shares %s records, fields and deletes across named and string roots", async collection => {
    const database = new LocalDatabase({storageKey: "aliases"});
    const string = [collection, {post_id: "p1"}];
    const named = [{type: collection}, {post_id: "p1"}];
    await database.update(named, () => ({text: "created", count: 0}));
    expect(await database.read(string)).toEqual(created({text: "created", count: 0}));
    await database.update(string, {text: "updated"});
    expect(await database.read(named)).toEqual(created({text: "updated", count: 0}));
    await database.update([...named, "text"], () => "field");
    expect(await database.read([...string, "text"])).toBe("field");
    expect(await database.update([...named, "count"], value => value + 1)).toBe(1);
    expect(await database.update([...string, "count"], value => value + 1)).toBe(2);
    await database.delete([...string, "text"]);
    expect(await database.read([...named, "text"])).toBeUndefined();
    await database.delete(named);
    expect(await database.read(string)).toBeUndefined();
    await database.update(string, () => ({text: "reverse"}));
    expect(await database.read(named)).toEqual(created({text: "reverse"}));
    await database.delete(string);
    expect(await database.read(named)).toBeUndefined();
});

it("keeps the posts draft identity and nested draft levels unchanged", async () => {
    const database = new LocalDatabase({storageKey: "meta"});
    const path = Object.freeze([Object.freeze({type: "posts"})]);
    const draft = database.create([...path, "post_id"]);
    const key = await draft.save({text: "post"});
    const post = ["posts", {post_id: key}];
    expect(await database.read(post)).toEqual(created({text: "post"}));
    const edit = database.create([{name: "posts"}, {post_id: key}, "edit", "id"]);
    const editKey = await edit.save({uid: "u1"});
    expect(await database.read([...post, "edit", {id: editKey}])).toEqual(created({uid: "u1"}));
    expect(await database.readSubtree([{type: "posts"}, {post_id: key}])).toMatchObject({
        edit: {[editKey]: {uid: "u1"}}
    });
    const reply = database.create([{type: "replies"}, "post_id"]);
    const replyKey = await reply.save({text: "reply"});
    expect(await database.read(["replies", {post_id: replyKey}])).toEqual(created({text: "reply"}));
    expect(path).toEqual([{type: "posts"}]);
});

it("uses named collections in batch replacements and type queries without storing root metadata", async () => {
    const database = new LocalDatabase({storageKey: "batch"});
    const record = [{name: "replies"}, {kind: "r1", _: 0}];
    await database.update(new Map([[record, {text: "reply", nested: {enabled: true}}]]));
    await database.update(new Map([[[{type: "replies"}, {kind: "r1", _: 0}, "text"], "updated"]]));
    expect(await database.read(["replies", {kind: "r1", _: 0}, "text"])).toBe("updated");
    for (const query of ["kind", {_key0: "kind"}]) {
        expect(await getRecordsByType("batch", [{type: "replies"}, query])).toEqual([
            {id: "r1", value: created({text: "updated", nested: {enabled: true}})}
        ]);
    }
    const rows = await getAllRecords("batch");
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("_conditions");
    expect(rows[0]).toMatchObject({_collection: "replies", _key0: "kind"});
    await database.update(new Map([[[{type: "replies"}], {r1: {text: "replaced"}}]]));
    expect(await database.read(["replies"])).toEqual({r1: created({text: "replaced"})});
    await database.delete([{type: "replies"}]);
    expect(await database.read(["replies"])).toBeUndefined();
});

it("notifies listeners for writes through either root form", async () => {
    const database = new LocalDatabase({storageKey: "listeners"});
    const string = ["posts", {post_id: "p1"}], named = [{type: "posts"}, {post_id: "p1"}];
    const first = vi.fn(), second = vi.fn(), collection = vi.fn();
    const listeners = [database.addEventListener(string, {onChange: first}),
        database.addEventListener(named, {onChange: second}),
        database.addEventListener([{name: "posts"}], {onChildAdd: collection})];
    try {
        await vi.waitFor(() => expect(second).toHaveBeenCalledOnce());
        await database.update(named, () => ({text: "first"}));
        expect(first).toHaveBeenLastCalledWith(created({text: "first"}));
        expect(second).toHaveBeenLastCalledWith(created({text: "first"}));
        expect(collection).toHaveBeenLastCalledWith({key: "p1", value: created({text: "first"})});
        await database.update(string, {text: "second"});
        expect(second).toHaveBeenLastCalledWith(created({text: "second"}));
        await database.delete(named);
        expect(first).toHaveBeenLastCalledWith(undefined);
        expect(second).toHaveBeenLastCalledWith(undefined);
    } finally { listeners.forEach(listener => listener.remove()); }
});

it.each(["follow", "watch", "_posts"])("rejects obsolete root %s", async name => {
    const database = new LocalDatabase({storageKey: "validation"});
    const named = [{type: name}, {id: "r1"}];
    await expect(database.update(named, () => ({name}))).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(() => database.create([{type: name}])).toThrow();
    expect(() => database.addEventListener(named, {})).toThrow();
    await expect(database.update([name, {id: "r1"}], () => ({name})))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});

it.each([[], [{}], [{type: ""}], [{type: "posts", other: "replies"}], [{type: "posts"}, ""]])(
    "retains invalid path rejection for %j", path => {
        expect(() => parseDatabasePath(path)).toThrow();
    }
);
