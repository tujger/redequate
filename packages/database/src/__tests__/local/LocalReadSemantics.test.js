import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("reads exact fields and nested collections without suffix guesses", async () => {
    const database = new LocalDatabase({storageKey: "read-shapes"});
    const post = ["posts", {post_id: "p"}];
    await database.update(post, () => ({owner_id: {id: "u", roles: ["a"]}, id: ["one", "two"],
        post_id: false}));
    const comments = [...post, "comments"];
    await database.update([...comments, {comment_id: "a"}], () => ({created: 100, owner_id: "u"}));
    await database.update([...comments, {comment_id: "b"}], () => ({created: 200, owner_id: "v"}));
    await database.update(["posts", {other_id: "x"}], () => ({created: 300}));
    expect(Object.keys(await database.read(["posts"])).sort()).toEqual(["p", "x"]);
    expect(await database.read(["posts", {post_id: "post_id"}])).toBeUndefined();
    expect(await database.read(["posts", {other_id: "other_id"}])).toBeUndefined();
    expect(await database.read([...post, {owner_id: "owner_id"}])).toEqual({id: "u", roles: ["a"]});
    expect(await database.read([...post, {id: "id"}])).toEqual(["one", "two"]);
    expect(await database.read([...post, {post_id: "post_id"}])).toBe(false);
    expect(Object.keys(await database.read([...post, {comments: "comments"}])).sort()).toEqual(["a", "b"]);
    expect(Object.keys(await database.read([...post, {comments: "comments"}],
        {orderBy: "created", order: "desc", start: 100, end: 200})).sort()).toEqual(["a", "b"]);
    expect(await database.read([...comments, {comment_id: "comment_id"}])).toBeUndefined();
    expect(await database.read([...comments, {comment_id: "b"}, {owner_id: "owner_id"}])).toBe("v");
    expect(await database.read([...comments, {comment_id: "missing"}])).toBeUndefined();
});

it("filters ordered collections with inclusive bounds and equality", async () => {
    const database = new LocalDatabase({storageKey: "read-query"});
    for (const [key, created] of [["a", 100], ["b", 150], ["c", 200], ["d", 250]]) {
        await database.update(["posts", {post_id: key}], () => ({created}));
    }
    const all = await database.read(["posts"]);
    await database.update(["posts", {other_id: "mixed"}], () => ({created: 175}));
    expect(Object.keys(await database.read(["posts"],
        {orderBy: "created", order: "desc", start: 100, end: 200})).sort()).toEqual(["a", "b", "c", "mixed"]);
    expect(await database.read(["posts"], {orderBy: "created", equalTo: 150}))
        .toEqual({b: all.b});
    expect(await database.read(["posts"], {orderBy: "created", start: 300})).toBeUndefined();
    await expect(database.read(["posts"], {equalTo: 1, end: 2}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});

it("queries values and numeric keys at nested and record paths", async () => {
    const database = new LocalDatabase({storageKey: "read-query-children"});
    const post = ["posts", {post_id: "p"}];
    await database.update(post, () => ({states: {a: "active", b: "idle", c: "active"},
        scores: {"2": "a", "10": "b", "02": "c", z: "d"},
        first: {created: "active"}, second: {created: "idle"}}));
    expect(await database.read([...post, {states: "states"}], {equalTo: "active"}))
        .toEqual({a: "active", c: "active"});
    expect(await database.read([...post, {states: "states"}], {orderBy: "", equalTo: "active"}))
        .toEqual({a: "active", c: "active"});
    expect(await database.read([...post, {scores: "scores"}], {start: "2", end: "10"}))
        .toEqual({"2": "a", "10": "b", "02": "c"});
    expect(await database.read([...post, {scores: "scores"}], {start: "02", end: "z", order: "desc"}))
        .toEqual({"02": "c", "10": "b", z: "d"});
    expect(await database.read(post, {orderBy: "created", equalTo: "active"}))
        .toEqual({first: {created: "active"}});
    await expect(database.read([])).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.read([], {onError: vi.fn()}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});

it("reads a literal child beside records with named identities", async () => {
    const database = new LocalDatabase({storageKey: "literal-post-child"});
    await database.update(["posts", {post_id: "p1"}], () => ({created: 100}));
    await database.update(["posts", "post_id"], () => ({marker: "literal"}));
    expect(await database.read(["posts", {post_id: "post_id"}])).toEqual({marker: "literal"});
    expect(await database.read(["posts", {post_id: "p1"}])).toMatchObject({created: 100});
    expect(await database.read(["posts"])).toMatchObject({post_id: {marker: "literal"}, p1: {created: 100}});
});

it("keeps array paths exact for settings and reports read errors", async () => {
    const onError = vi.fn();
    const database = new LocalDatabase({storageKey: "literal-settings", onError});
    await database.update(["meta", "settings"], () => ({theme: "dark"}));
    expect(await database.read("meta/settings")).toEqual({theme: "dark"});
    expect(await database.read(["meta", {settings: "settings"}])).toEqual({theme: "dark"});
    expect(await database.read(["meta", {settings: "settings"}], {order: "backward"})).toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}),
        "read", expect.objectContaining({path: ["meta", {settings: "settings"}]}));
});

it("selects only the requested identity field, including dynamic identities and descendants", async () => {
    const database = new LocalDatabase({storageKey: "identity-reads"});
    await database.create(["users_public", {user_id: "fixed"}], {name: "Fixed"});
    await database.update(["users_public", {user_id: "dynamic", _: 0}], () => ({name: "Dynamic"}));
    await database.update(["users_public", {user_id: "dynamic", _: 0}, "devices", {device_id: "phone"}], () => ({locale: "en"}));
    await database.create(["users_public", {other_id: "other"}], {name: "Other identity"});
    expect(await database.read(["users_public", "user_id"])).toEqual({
        fixed: {name: "Fixed"},
        dynamic: {name: "Dynamic", devices: {phone: {locale: "en"}}}
    });
    expect(await database.read(["users_public", {user_id: "dynamic"}])).toEqual({name: "Dynamic", devices: {phone: {locale: "en"}}});
    expect(await database.read(["users_public", {user_id: "dynamic"}, {name: "name"}])).toBe("Dynamic");
    expect(await database.read(["users_public", "other_id"])).toEqual({other: {name: "Other identity"}});
    expect(await database.read(["users_public", "absent_id"])).toBeUndefined();
});

it("reads an actual named identity equal to its field name", async () => {
    const database = new LocalDatabase({storageKey: "same-name-identity"});
    await database.create(["users_public", {user_id: "user_id"}], {name: "Named"});
    expect(await database.read(["users_public", {user_id: "user_id"}])).toEqual({name: "Named"});
});
