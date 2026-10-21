import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import {getAllRecords, getRecordsByType, openDatabase} from "../../local/helpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const user = ["users_public", {user_id: "u1"}];
const email = [...user, {email: "email"}];
const created = value => value;

it("uses the same field for literal, named, batch and transactional updates", async () => {
    const database = new LocalDatabase({storageKey: "aliases"});
    await database.update(email, () => "first");
    await database.update(new Map([[[...user, "email"], "second"]]));
    expect(await database.update(email, value => value + "!")).toBe("second!");
    expect(await database.read([...user, {email: "email"}])).toBe("second!");
    await expect(database.update(new Map([[email, "one"], [[...user, "email"], "two"]])))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(email)).toBe("second!");
    expect(await database.update([...user, "email"], () => undefined)).toBeNull();
    await database.update(email, () => "second!");
    expect(await database.update(email, () => null)).toBeNull();
    expect(await database.read([...user, {email: "email"}])).toBeUndefined();
});

it("matches fixed conditions independently of their order and serialized location", async () => {
    const database = new LocalDatabase({storageKey: "direct-query"});
    const first = ["extra", {owner: "alice"}, {email: "a@b.com"}];
    await database.update(first, () => ({active: true}));
    expect(await database.read(["extra", {email: "a@b.com"}, {owner: "alice"}])).toEqual(created({active: true}));
    const row = (await getAllRecords("direct-query"))[0];
    const connection = await openDatabase("direct-query");
    try {
        await new Promise((resolve, reject) => {
            const transaction = connection.transaction("extra", "readwrite");
            transaction.objectStore("extra").put({...row, email: "new@b.com"});
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { connection.close(); }
    const changed = ["extra", {owner: "alice"}, {email: "new@b.com"}];
    expect(await database.read(first)).toBeUndefined();
    expect(await database.read(changed)).toEqual(created({active: true}));
    await database.update(changed, () => ({active: false}));
    expect(await database.read(changed)).toEqual(created({active: false}));
    expect(await getAllRecords("direct-query")).toHaveLength(1);
    await database.delete(changed);
    expect(await database.read(changed)).toBeUndefined();
});

it("applies direct fixed conditions to indexed type queries", async () => {
    const database = new LocalDatabase({storageKey: "indexed-query"});
    await database.update(["extra", {type: "friend", _: true}, {email: "a@b.com"}], () => ({active: true}));
    await database.update(["extra", {type: "friend", _: true}, {email: "other@b.com"}], () => ({active: false}));
    expect(await getRecordsByType("indexed-query", ["extra", {_key0: "type", email: "a@b.com"}]))
        .toEqual([{id: "friend", value: created({active: true})}]);
});

it("rejects overlapping queries when the parent conditions occur later in the stored address", async () => {
    const database = new LocalDatabase({storageKey: "query-overlap"});
    const child = ["extra", {email: "a@b.com"}, {owner: "alice"}];
    await database.update(child, () => ({active: true}));
    await expect(database.update(new Map([
        [["extra", {owner: "alice"}], {active: false}], [child, {active: false}]
    ]))).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.read(child)).toEqual(created({active: true}));
});

it("retains known named children when replacing their parent query", async () => {
    const database = new LocalDatabase({storageKey: "named-children"});
    const parent = ["users_private", {user_id: "u1"}];
    const phone = [...parent, {device_id: "phone"}];
    const tablet = [...parent, {device_id: "tablet"}];
    await database.update(phone, () => ({locale: "en"}));
    await database.update(tablet, () => ({locale: "fr"}));
    await database.update(parent, () => ({phone: {locale: "de"}}));
    expect(await database.read(phone)).toEqual(created({locale: "de"}));
    expect(await database.read(tablet)).toBeUndefined();
    const rows = await getAllRecords("named-children");
    expect(rows.find(row => row.device_id === "phone")).toMatchObject({user_id: "u1", device_id: "phone"});
});

it("reads legacy named field rows without rewriting them and replaces them through either alias", async () => {
    const database = new LocalDatabase({storageKey: "legacy-field"});
    const key = JSON.stringify([["fixed", "user_id", "u1"], ["fixed", "email", "email"]]);
    const connection = await openDatabase("legacy-field");
    try {
        await new Promise((resolve, reject) => {
            const transaction = connection.transaction("users_public", "readwrite");
            transaction.objectStore("users_public").put({_collection: "users_public", _key: key,
                _conditions: {user_id: "u1", email: "email"}, value: "old@b.com"});
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { connection.close(); }
    expect(await database.read([...user, {email: "email"}])).toBe("old@b.com");
    expect(await database.read(email)).toBe("old@b.com");
    expect((await getAllRecords("legacy-field"))[0]._key).toBe(key);
    await database.update(email, () => "new@b.com");
    expect(await database.read([...user, {email: "email"}])).toBe("new@b.com");
    const rows = await getAllRecords("legacy-field");
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("_conditions");
});

it("does not revive an embedded value after deleting its separately stored replacement", async () => {
    const database = new LocalDatabase({storageKey: "embedded"});
    const post = ["posts", {post_id: "p1"}];
    const edit = [...post, "edit", {edit_id: "e1"}];
    await database.update(post, () => ({edit: {e1: {text: "old"}, e2: {text: "kept"}}}));
    expect(await database.read(edit)).toEqual({text: "old"});
    await database.update(edit, () => ({text: "new"}));
    expect(await database.read(edit)).toEqual(created({text: "new"}));
    await database.delete(edit);
    expect(await database.read(edit)).toBeUndefined();
    expect(await database.read(post)).toEqual(created({edit: {e2: {text: "kept"}}}));
    await database.delete([...post, {edit: "edit"}]);
    expect(await database.read(post)).toBeUndefined();
});

it("delivers equivalent named and literal field subscriptions after commit", async () => {
    const database = new LocalDatabase({storageKey: "field-listeners"});
    const named = vi.fn(), literal = vi.fn();
    const handles = [database.addEventListener(email, {onChange: named}),
        database.addEventListener([...user, "email"], {onChange: literal})];
    try {
        await vi.waitFor(() => expect(literal).toHaveBeenCalledOnce());
        await database.update(email, () => "a@b.com");
        expect(named).toHaveBeenLastCalledWith("a@b.com");
        expect(literal).toHaveBeenLastCalledWith("a@b.com");
        await database.delete([...user, "email"]);
        expect(named).toHaveBeenLastCalledWith(undefined);
        expect(literal).toHaveBeenLastCalledWith(undefined);
        expect(named).toHaveBeenCalledTimes(3);
        expect(literal).toHaveBeenCalledTimes(3);
    } finally { handles.forEach(handle => handle.remove()); }
});
