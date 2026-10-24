import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {getAllRecords, openDatabase} from "../../local/helpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const friendship = ["mutual", {friendship: "m123", _: true}];
const numericFriendship = ["mutual", {friendship: "m123", _: 0}];
const nested = ["mutual", {friendship: "m123", _: true}, "members", {member: "u456", _: 1}];
const created = value => value;

it("creates records with permanent keys", async () => {
    const database = new LocalDatabase({storageKey: "meta"});
    const key = await database.create(["mutual", "id"], {name: "created"});
    expect(key).toBe("1");
    expect(await database.read(["mutual", {id: key}])).toEqual(created({name: "created"}));
    await expect(database.create(["mutual", {id: key}], {name: "duplicate"})).rejects.toMatchObject({name: "ConstraintError"});

    const childKey = await database.create([...friendship, "id"], {name: "child"});
    expect(await database.read([...friendship, {id: childKey, _: 1}])).toEqual(created({name: "child"}));
});

it("creates posts under the post_id identity used by post reads", async () => {
    const database = new LocalDatabase({storageKey: "posts"});
    const key = await database.create(["posts", "post_id"], {text: "Post"});
    expect(await database.read(["posts", {post_id: key}])).toEqual(created({text: "Post"}));
    expect(await database.read(["posts", {id: key, _: true}])).toBeUndefined();
});

it("assembles a private user subtree from separate device records", async () => {
    const database = new LocalDatabase({storageKey: "subtree"});
    const user = ["users_private", {user_id: "u1"}];
    expect(await database.readSubtree(user)).toBeUndefined();
    await database.update(new Map([
        [[...user, {device_id: "phone"}, "locale"], "en"],
        [[...user, {device_id: "phone"}, "enabled"], true],
        [[...user, {device_id: "tablet"}, "locale"], "fr"],
        [["users_private", {user_id: "u2"}, {device_id: "phone"}, "locale"], "de"]
    ]));
    expect(await database.read(user)).toEqual(await database.readSubtree(user));
    expect(await database.readSubtree(user)).toEqual({
        phone: created({locale: "en", enabled: true}), tablet: created({locale: "fr"})
    });
});

it("reads every record in a literal collection and keeps sibling collections isolated", async () => {
    const database = new LocalDatabase({storageKey: "literal-collections"});
    const settings = ["meta", "settings"];
    expect(await database.readSubtree(settings)).toBeUndefined();
    await database.update([...settings, {setting_id: "theme"}], () => ({value: "dark"}));
    await database.update([...settings, {setting_id: "locale"}], () => ({value: "en"}));
    await database.update(["meta", "maintenance", {setting_id: "theme"}], () => ({value: "off"}));
    await database.update(["meta", {meta_id: "settings"}], () => ({value: "single record"}));
    await database.update(["errors", "settings", {setting_id: "theme"}], () => ({value: "errors"}));
    const expected = {theme: created({value: "dark"}), locale: created({value: "en"})};
    expect(await database.readSubtree(settings)).toEqual(expected);
    expect(await database.readSubtree(settings)).toEqual(expected);
    expect(await database.read([...settings, {setting_id: "theme"}])).toEqual(created({value: "dark"}));
    expect(await database.readSubtree(["meta", "maintenance"])).toEqual({theme: created({value: "off"})});
    const generated = await database.create([...settings, "setting_id"], {value: "generated"});
    expect(await database.read([...settings, {setting_id: generated}])).toEqual(created({value: "generated"}));
});

it("preserves nested collections and named record paths in a collection subtree", async () => {
    const database = new LocalDatabase({storageKey: "nested-collections"});
    const settings = ["meta", "settings"];
    const theme = [...settings, {setting_id: "theme"}];
    await database.update(theme, () => ({label: "Theme"}));
    await database.update([...theme, "options", {option_id: "dark"}], () => ({enabled: true}));
    await database.update([...theme, "options", {option_id: "light"}], () => ({enabled: false}));
    await database.update([...settings, {setting_id: "locale"}], () => ({label: "Locale"}));
    await database.update(["meta", "settingsExtra", {setting_id: "errors"}], () => ({label: "Other"}));
    expect(await database.readSubtree(settings)).toEqual({
        theme: {
            options: {dark: created({enabled: true}), light: created({enabled: false})},
            ...created({label: "Theme"})
        },
        locale: created({label: "Locale"})
    });
    expect(await database.readSubtree([...theme, "options"])).toEqual({
        dark: created({enabled: true}), light: created({enabled: false})
    });
    expect(await database.read([...theme, {options: "options"}])).toEqual({
        dark: created({enabled: true}), light: created({enabled: false})
    });
    expect(await database.read(theme)).toEqual(created({
        label: "Theme",
        options: {dark: created({enabled: true}), light: created({enabled: false})}
    }));
    expect(await database.read([...theme, {label: "label"}])).toBe("Theme");
    await database.update([...theme, "options"], () => ({default: "dark"}));
    const options = {default: "dark"};
    expect(await database.read([...theme, {options: "options"}])).toEqual(options);
    expect(await database.readSubtree([...theme, "options"])).toEqual(options);
});

it("writes and replaces the settings collection while preserving child identities", async () => {
    const database = new LocalDatabase({storageKey: "settings-write"});
    const settings = ["meta", "settings"];
    const theme = [...settings, {setting_id: "theme"}];
    await database.update(theme, () => ({value: "light"}));
    await database.update(settings, () => ({theme: {value: "dark"}, locale: {value: "en"}}));
    expect(await database.read(theme)).toEqual(created({value: "dark"}));
    expect(await database.readSubtree(settings)).toEqual({theme: created({value: "dark"}), locale: created({value: "en"})});
    await database.update(settings, () => ({locale: {value: "fr"}}));
    expect(await database.read(theme)).toBeUndefined();
    expect(await database.readSubtree(settings)).toEqual({locale: created({value: "fr"})});
    expect(await database.readSubtree(settings)).toEqual(await database.readSubtree(settings));
});

it("accepts the flat Settings.js batch payload with arrays and null removals", async () => {
    const database = new LocalDatabase({storageKey: "settings-payload"});
    const settings = ["meta", "settings"];
    await database.update(new Map([[settings, {
        postsAllowEdit: true,
        uploadsMaxSize: 100,
        uploadsTypes: ["audio/*", "video/*"],
        joinUsTitle: null
    }]]));
    expect(await database.readSubtree(settings)).toEqual({
        postsAllowEdit: true, uploadsMaxSize: 100, uploadsTypes: ["audio/*", "video/*"]
    });
    await database.update(new Map([[settings, {postsAllowEdit: false, uploadsMaxSize: null}]]));
    expect(await database.readSubtree(settings)).toEqual({postsAllowEdit: false});
});

it("updates settings children, nested collections and null removals in one transaction", async () => {
    const database = new LocalDatabase({storageKey: "settings-update"});
    const settings = ["meta", "settings"];
    await database.update(settings, () => ({
        theme: {value: "dark", options: {light: {enabled: true}}},
        locale: {value: "en"}
    }));
    expect(await database.readSubtree(settings)).toEqual({
        theme: {options: {light: created({enabled: true})}, ...created({value: "dark"})},
        locale: created({value: "en"})
    });
    await database.update(settings, {locale: null, theme: {value: "light", options: {dark: {enabled: true}}}});
    expect(await database.readSubtree(settings)).toEqual({
        theme: {options: {dark: created({enabled: true})}, ...created({value: "light"})}
    });
    await database.update(new Map([[settings, {theme: null, postsAllowEdit: {value: true}}]]));
    expect(await database.readSubtree(settings)).toEqual({postsAllowEdit: created({value: true})});
    await database.delete(settings);
    expect(await database.readSubtree(settings)).toBeUndefined();
    expect(await database.readSubtree(settings)).toBeUndefined();
    await database.update(settings, () => ({theme: {value: "again"}}));
    await database.delete(settings);
    expect(await database.readSubtree(settings)).toBeUndefined();
});

it("preserves existing identities and gives new collection children a generic id", async () => {
    const database = new LocalDatabase({storageKey: "posts-collection"});
    const post = ["posts", {post_id: "p1"}];
    await database.update(post, () => ({text: "old"}));
    await database.update(["posts"], () => ({p1: {text: "new"}, p2: {text: "second"}}));
    expect(await database.read(post)).toEqual(created({text: "new"}));
    expect(await database.read(["posts", {id: "p2"}])).toEqual(created({text: "second"}));
    expect(await database.read(["posts"])).toEqual({p1: created({text: "new"}), p2: created({text: "second"})});
});

it("rolls back a failed collection batch without changing existing records", async () => {
    const database = new LocalDatabase({storageKey: "settings-rollback"});
    const settings = ["meta", "settings"];
    await database.update(settings, () => ({theme: {value: "old"}}));
    const before = await database.readSubtree(settings);
    await expect(database.update(new Map([[settings, {theme: {value: "new"}}],
        [["posts", {post_id: "bad"}], {value: () => "not cloneable"}]])))
        .rejects.toBeInstanceOf(Error);
    expect(await database.readSubtree(settings)).toEqual(before);
});

it("creates a missing parent for a field write and leaves no record for absent nulls", async () => {
    const database = new LocalDatabase({storageKey: "field-parent"});
    await database.delete([...friendship, "missing"]);
    expect(await getAllRecords("field-parent")).toEqual([]);
    await database.update([...friendship, "name"], () => "created");
    expect(await database.read(friendship)).toEqual(created({name: "created"}));
    await database.delete([...friendship, "name"]);
    expect(await database.read([...friendship, {name: "name"}])).toBeUndefined();
    expect(await database.read(friendship)).toBeUndefined();
});

it("reads, writes, updates and deletes records with dynamic levels", async () => {
    const database = new LocalDatabase({storageKey: "crud"});
    expect(await database.read(friendship)).toBeUndefined();
    await database.delete(friendship);
    await database.update(friendship, () => ({name: "first", nested: {kept: true}, removed: 1}));
    expect(await database.read(numericFriendship)).toEqual(created({name: "first", nested: {kept: true}, removed: 1}));
    await database.update(numericFriendship, {name: "second", removed: null});
    expect(await database.read(friendship)).toEqual(created({name: "second", nested: {kept: true}}));

    await database.update(nested, () => ({name: "nested"}));
    expect(await database.read(nested)).toEqual(created({name: "nested"}));
    expect(await database.read(friendship)).toEqual(created({
        name: "second",
        nested: {kept: true},
        members: {u456: created({name: "nested"})}
    }));
    await database.delete(nested);
    expect(await database.read(nested)).toBeUndefined();
    await database.delete(friendship);
    expect(await database.read(friendship)).toBeUndefined();
});

it("reads and changes top-level fields while preserving the record", async () => {
    const database = new LocalDatabase({storageKey: "fields"});
    expect(await database.read([...friendship, {name: "name"}])).toBeUndefined();
    await database.delete([...friendship, "name"]);
    await database.delete([...friendship, "name"]);
    await database.update(friendship, () => ({name: "first", nested: {kept: true}}));
    await database.update([...numericFriendship, "name"], () => "second");
    expect(await database.read([...friendship, {name: "name"}])).toBe("second");
    await database.update([...friendship, "active"], () => false);
    await database.delete([...friendship, "nested"]);
    expect(await database.read(friendship)).toEqual(created({name: "second", active: false}));
    await database.delete([...friendship, "active"]);
    expect(await database.read(friendship)).toEqual(created({name: "second"}));
    await database.delete([...friendship, "missing"]);
});

it("creates an absent record on a non-null update and ignores empty removals", async () => {
    const database = new LocalDatabase({storageKey: "updates"});
    await database.update(friendship, {removed: null});
    expect(await database.read(friendship)).toBeUndefined();
    await database.update(friendship, {active: true});
    expect(await database.read(friendship)).toEqual(created({active: true}));
    await database.update(friendship, {active: null});
    expect(await database.read(friendship)).toBeUndefined();
});

it("reports invalid operations and IndexedDB failures through DatabaseBase", async () => {
    const onError = vi.fn();
    const database = new LocalDatabase({storageKey: "errors", onError});
    await expect(database.create(["mutual", {friendship: "m123", _: -1}], {})).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}),
        "create", {path: ["mutual", {friendship: "m123", _: -1}], value: {}});
    await expect(database.update(friendship, () => undefined)).resolves.toBeNull();
    await expect(database.update(friendship, {invalid: undefined})).resolves.toBeUndefined();
    expect(await database.read(friendship)).toBeUndefined();
    await expect(database.read(friendship, {order: "backward"})).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({code: "database/invalid-argument"}),
        "read", {
            path: friendship,
            equalTo: undefined,
            orderBy: undefined,
            order: "backward",
            start: undefined,
            end: undefined
        });

    const failure = new Error("IndexedDB unavailable");
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw failure; });
    await expect(database.read(friendship, {onError: error => { throw error; }})).rejects.toBe(failure);
});

it("resolves local timestamp and increment markers against prior values", async () => {
    const database = new LocalDatabase({storageKey: "sentinels"});
    vi.spyOn(Date, "now").mockReturnValue(1234);
    try {
        expect(database.TIMESTAMP).not.toEqual({".sv": "timestamp"});
        expect(database.increment(-2)).not.toEqual({".sv": {increment: -2}});
        await database.update(friendship, () => ({
            timestamp: database.TIMESTAMP,
            count: database.increment(2),
            nested: {count: database.increment(3)}
        }));
        expect(await database.read(friendship)).toEqual({timestamp: 1234, count: 2, nested: {count: 3}});
        await database.update([...friendship, "count"], () => database.increment(-1));
        await database.update(friendship, {count: database.increment(4), nested: {count: database.increment(2)}});
        expect(await database.read(friendship)).toEqual({timestamp: 1234, count: 5, nested: {count: 5}});
        const key = await database.create(["meta", "id"], {timestamp: database.TIMESTAMP, count: database.increment(1)});
        expect(await database.read(["meta", {id: key}])).toEqual({timestamp: 1234, count: 1});
        await database.update(friendship, () => ({ordinary: {".sv": "unknown"}}));
        expect(await database.read(friendship)).toEqual({ordinary: {".sv": "unknown"}});
        expect(() => database.increment(Infinity)).toThrow();
    } finally { vi.restoreAllMocks(); }
});

it("does not add creation time to values across existing record writes", async () => {
    const database = new LocalDatabase({storageKey: "times"});
    const now = vi.spyOn(Date, "now");
    try {
        now.mockReturnValue(100);
        await database.update(friendship, () => ({name: "first"}));
        now.mockReturnValue(200);
        await database.update([...friendship, "name"], () => "second");
        await database.update(friendship, () => ({name: "third"}));
        let rows = await getAllRecords("times");
        expect(rows).toHaveLength(1);
        expect(rows[0].value).toEqual({name: "third"});
        expect(rows[0]).not.toHaveProperty("_updatedAt");
        const connection = await openDatabase("times");
        try {
            expect(connection.transaction("meta").objectStore("meta").indexNames.contains("_updatedAt")).toBe(false);
        } finally { connection.close(); }
        await database.delete(friendship);
        rows = await getAllRecords("times");
        expect(rows).toEqual([]);
    } finally { vi.restoreAllMocks(); }
});

it("keeps explicit timestamps and leaves primitives without a timestamp", async () => {
    const database = new LocalDatabase({storageKey: "value-shapes"});
    vi.spyOn(Date, "now").mockReturnValue(100);
    try {
        await database.update(friendship, () => ({timestamp: null, nested: {name: "one"}}));
        await database.update(friendship, () => ({nested: {name: "two"}}));
        expect(await database.read(friendship)).toEqual({nested: {name: "two"}});
        await database.update(nested, () => "primitive");
        expect(await database.read(nested)).toBe("primitive");
        await database.update(nested, () => ({name: "later"}));
        expect(await database.read(nested)).toEqual({name: "later"});
        await database.delete(nested);
        await database.update(nested, () => ({name: "new"}));
        expect(await database.read(nested)).toEqual({name: "new"});
    } finally { vi.restoreAllMocks(); }
});

it("applies Map and string batch paths atomically and rejects overlapping paths", async () => {
    const database = new LocalDatabase({storageKey: "batch"});
    await database.update(friendship, () => ({count: 2, kept: true}));
    await database.update(new Map([
        [[...friendship, "count"], database.increment(3)],
        ["mutual/m123/added", database.TIMESTAMP],
        ["mutual/new/name", "new"]
    ]));
    expect(await database.read(friendship)).toEqual(created({count: 5, kept: true, added: expect.any(Number)}));
    expect((await getAllRecords("batch")).find(row => row._collection === "mutual" && row.id === "new")?.value).toEqual(created({name: "new"}));
    await database.update(new Map([[[...friendship, "kept"], null], ["mutual/new", null]]));
    expect(await database.read(friendship)).toEqual(created({count: 5, added: expect.any(Number)}));
    await expect(database.update(new Map([[[...friendship, "count"], 9], ["mutual/m123/count", 10]])))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read([...friendship, {count: "count"}])).toBe(5);
    await expect(database.update(new Map([[[...friendship, "count"], 9], ["mutual/m123/bad", undefined]])))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read([...friendship, {count: "count"}])).toBe(5);
    await expect(database.update(new Map([[[...friendship, "count"], 9],
        ["mutual/new/bad", () => "cannot clone"]]))).rejects.toBeInstanceOf(Error);
    expect(await database.read([...friendship, {count: "count"}])).toBe(5);
    const fresh = ["mutual", {friendship: "fresh", _: true}];
    await database.update(new Map([["mutual/fresh/name", "first"], [[...fresh, "count"], 1]]));
    expect(await database.read(fresh)).toEqual(created({name: "first", count: 1}));
    await database.update(new Map([["mutual/fresh/nested", {
        count: database.increment(2),
        times: [database.TIMESTAMP]
    }], ["mutual/fresh/count", database.increment(4)]]));
    expect(await database.read(fresh)).toEqual(created({
        name: "first",
        count: 5,
        nested: {count: 2, times: [expect.any(Number)]}
    }));
    const before = await database.read(fresh);
    await expect(database.update(new Map([["mutual/fresh/count", database.increment(10)],
        ["mutual/failed/name", () => "cannot clone"]]))).rejects.toBeInstanceOf(Error);
    expect(await database.read(fresh)).toEqual(before);
    expect(await database.read(["mutual", {id: "failed", _: true}])).toBeUndefined();
});

it("rejects an incompatible version-one database without migrating", async () => {
    const request = indexedDB.open("redequate:local:existing-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("meta", {keyPath: ["_collection", "_key"]});
    const old = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    old.close();
    await expect(openDatabase("existing-v1")).rejects.toMatchObject({name: "VersionError"});
});
