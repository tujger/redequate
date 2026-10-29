import {vi} from "vitest";
import DatabaseBase from "../../common/DatabaseBase";
import DatabaseCursor from "../../common/DatabaseCursor";
import resolvePath from "../../common/resolvePath";
import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";
import {createBackend} from "../fixtures/backend";

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

const path = ["users_public", {user_id: "u123"}, "email"];
let fixture, database, backend;
beforeEach(() => {
    fixture = createFirebase();
    backend = createBackend();
    database = new FirebaseDatabase({firebase: fixture.firebase, backend});
});

it("resolves named segment values and normalizes slashes", () => {
    expect(resolvePath(path)).toBe("users_public/u123/email");
    expect(resolvePath(["/users_public/", {user_id: "/u123/"}, "email/"])).toBe("users_public/u123/email");
    expect(resolvePath("/users_public//u123/")).toBe("users_public/u123");
    expect(resolvePath(["users_public", {user_id: "u123"}, {field: "email"}])).toBe("users_public/u123/email");
    expect(resolvePath([])).toBe("");
    expect(resolvePath("")).toBe("");
    expect(() => resolvePath(["users_public", {user_id: ""}, "email"])).toThrow();
    expect(resolvePath(["users_public", {user_id: "u/a"}, "email"])).toBe("users_public/u/a/email");
    expect(resolvePath(["users_public", "u/a", "email"])).toBe("users_public/u/a/email");
    expect(() => resolvePath(null)).toThrow();
    expect(() => resolvePath(undefined)).toThrow();
});

it.each([false, -1, "0", null, undefined, 1.5, {level: 2}])(
    "rejects removed path metadata _ = %j", async metadata => {
        const path = ["mutual", {friendship: "m123", _: metadata}];
        expect(() => resolvePath(path)).toThrow();
        await expect(database.update(path, () => ({value: 1}))).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(backend.request).not.toHaveBeenCalled();
    }
);

it("allows underscore as an ordinary field", async () => {
    expect(resolvePath(["mutual", {_: "m123"}])).toBe("mutual/m123");
    expect(await database.create(["posts", "_"], {text: "ordinary key field"})).toBe("backend-key");
});

it("uses named segments in reads, writes, updates, deletes and creation", async () => {
    fixture.sdk.once.mockResolvedValue(fixture.snapshot("a@example.com"));
    expect(await database.read([...path.slice(0, -1), {email: "email"}])).toBe("a@example.com");
    expect(fixture.sdk.once.mock.calls[0][0].path).toBe("users_public/u123/email");
    await database.update(path, () => "b@example.com");
    await database.update(["users_public", {user_id: "u123"}], {email: "c@example.com"});
    await database.delete(path);
    expect(backend.request.mock.calls).toEqual([
        ["database.update", "users_public/u123/email", null, {mode: "read"}],
        ["database.update", "users_public/u123/email", "b@example.com", {mode: "replace", etag: "initial"}],
        ["database.update", "users_public/u123", null, {mode: "read"}],
        ["database.update", "users_public/u123", {email: "c@example.com"}, {mode: "replace", etag: "initial"}],
        ["database.delete", "users_public/u123/email"]
    ]);
    const createPath = ["users_public", {user_id: "u123"}, "posts", "id"];
    expect(await database.create(createPath, {text: "Post"})).toBe("backend-key");
    expect(backend.request).toHaveBeenLastCalledWith("database.create", createPath, {text: "Post"});
});

it("resolves named paths in batch updates", async () => {
    await database.update(new Map([[path, "a@example.com"], ["other", 1]]));
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", "", {"users_public/u123/email": "a@example.com", other: 1});
});

it("keeps nested field names and values through Map serialization", async () => {
    await database.update(new Map([
        [["users_private", {user_id: "u123"}, {device_id: "phone"}, "locale"], "en"],
        [["users_public", {user_id: "u123"}, "name"], null]
    ]));
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", "", {
        "users_private/u123/phone/locale": "en",
        "users_public/u123/name": null
    });
});

it("attaches and removes listeners at the resolved path", () => {
    const onChange = vi.fn();
    const listener = database.addEventListener([...path.slice(0, -1), {email: "email"}], {onChange});
    expect(fixture.sdk.listeners[0].ref.path).toBe("users_public/u123/email");
    fixture.emit("value", "a@example.com");
    expect(onChange).toHaveBeenCalledWith("a@example.com");
    listener.remove();
    expect(fixture.sdk.listeners).toHaveLength(0);
});

it("distinguishes paths with named segments from cursor compositions", async () => {
    expect(new DatabaseBase().cursor(path).path).toEqual(path);
    expect(new DatabaseBase().cursor([{path}]).path).toBeUndefined();
    const dynamicPath = ["mutual", {friendship: "m123"}];
    expect(database.cursor(dynamicPath).path).toBe("mutual/m123");
    expect(database.cursor([]).path).toBe("");
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({a: 1}));
    const cursor = database.cursor(["users_public", {user_id: "u123"}, {email: "email"}]);
    expect(cursor.path).toBe("users_public/u123/email");
    expect(await cursor.next()).toEqual([{key: "a", value: 1}]);
    expect(fixture.sdk.once.mock.calls[0][0].path).toBe("users_public/u123/email");
    expect(database.cursor(path).path).toBe("users_public/u123");
    const composed = database.cursor([{path: ["users_public", {user_id: "u123"}, {email: "email"}]}, {path: "users_public/u123/email"}]);
    expect(await composed.next(10)).toEqual([{key: "a", value: 1}]);
    expect(composed.path).toBeUndefined();
});

it("rejects empty read paths while retaining root cursors", async () => {
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({a: 1}));
    await expect(database.read([])).rejects.toMatchObject({code: "database/invalid-argument"});
    const cursor = database.cursor([]);
    expect(cursor.path).toBe("");
    expect(await cursor.next()).toEqual([{key: "a", value: 1}]);
    expect(fixture.sdk.once.mock.calls.map(([ref]) => ref.path)).toEqual([""]);
});

it.each(["users_public", [], ["users_public"]])(
    "validates create-specific path shape at runtime: %j", async invalid => {
        await expect(database.create(invalid, {})).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(fixture.sdk.refs).toHaveLength(0);
        expect(backend.request).not.toHaveBeenCalled();
    }
);

it.each([{}, {uid: "u123", tenant: "t1"}, {uid: 123}, {uid: null}, {uid: undefined},
    {"": "u123"}, [], new Date(), null, 123, Object.assign({uid: "u123"}, {[Symbol("extra")]: "value"})])(
    "rejects invalid named segments %j before accessing Firebase", async segment => {
        const invalid = ["users_public", segment];
        expect(() => resolvePath(invalid)).toThrow();
        await expect(database.read(invalid)).rejects.toMatchObject({code: "database/invalid-argument"});
        await expect(database.update(invalid, () => 1)).rejects.toMatchObject({code: "database/invalid-argument"});
        await expect(database.delete(invalid)).rejects.toMatchObject({code: "database/invalid-argument"});
        await expect(database.update(invalid, {a: 1})).rejects.toMatchObject({code: "database/invalid-argument"});
        await expect(database.create(invalid, {})).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(() => database.addEventListener(invalid)).toThrow();
        expect(() => database.cursor(invalid)).toThrow();
        expect(fixture.sdk.refs).toHaveLength(0);
        expect(backend.request).not.toHaveBeenCalled();
    }
);

it("reports invalid paths through the configured operation error handler", async () => {
    const onError = vi.fn();
    const invalid = ["users_public", {user_id: 123}];
    expect(await database.read(invalid, {onError})).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "database/invalid-argument"}),
        "read", {path: invalid, equalTo: undefined, orderBy: undefined});
});

it("preserves orderBy segments and resolves them only in Firebase", async () => {
    expect(new DatabaseCursor({orderBy: ["profile", "name"]}, path).orderBy).toEqual(["profile", "name"]);
    const orderBy = ["profile", {field: "name"}];
    expect(new DatabaseCursor({orderBy}, path).orderBy).toEqual(orderBy);
    expect(new DatabaseCursor({orderBy: "profile/name"}, path).orderBy).toBe("profile/name");
    const cursor = database.cursor(path, {orderBy, start: "Al"});
    await cursor.next();
    expect(fixture.sdk.once.mock.calls[0][0].query).toMatchObject({
        orderByChild: ["profile/name"], startAt: ["Al"], endAt: ["Al\uf8ff"]
    });
    await database.read(path, {orderBy, equalTo: "Alice"});
    expect(fixture.sdk.once.mock.calls[1][0].query).toEqual({orderByChild: ["profile/name"], equalTo: ["Alice"]});
    const listener = database.addEventListener(path, {orderBy, onChildAdd: vi.fn()});
    expect(fixture.sdk.listeners.find(item => item.type === "child_added").ref.query).toEqual({orderByKey: []});
    listener.remove();
});

it.each([[""], ["profile", {}], ["profile", {field: 1}], ["profile", {field: "name", extra: "x"}]])(
    "rejects invalid orderBy segments %j", (...parts) => {
        expect(() => new DatabaseCursor({orderBy: parts}, path)).toThrow();
    }
);

it.each([{orderBy: ""}, {orderBy: []}])("orders root values in Firebase: %j", async ({orderBy}) => {
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({b: 1, a: 3}));
    await database.cursor("records", {orderBy, start: 1, end: 3}).next(10);
    expect(fixture.sdk.once.mock.calls[0][0].query).toMatchObject({orderByValue: [], startAt: [1], endAt: [3]});
    await database.read("records", {orderBy, equalTo: 3});
    expect(fixture.sdk.once.mock.calls[1][0].query).toEqual({orderByValue: [], equalTo: [3]});
    const listener = database.addEventListener("records", {orderBy, onChildAdd: vi.fn()});
    expect(fixture.sdk.listeners.find(item => item.type === "child_added").ref.query).toEqual({orderByKey: []});
    listener.remove();
});


it("keeps parser Symbols out of backend request paths and values", async () => {
    const containsSymbol = value => typeof value === "symbol" || value !== null && typeof value === "object" &&
        (Reflect.ownKeys(value).some(key => typeof key === "symbol") || Object.values(value).some(containsSymbol));
    await database.create(["posts", "post_id"], key => ({text: key}));
    await database.create(["posts", {post_id: "{literal-key}"}], {text: "explicit key"});
    await database.update(["posts", {post_id: "p1"}, "text"], () => "updated");
    await database.delete(["posts", {post_id: "p1"}]);
    expect(containsSymbol(backend.request.mock.calls)).toBe(false);
    expect(backend.request).toHaveBeenCalledWith("database.create", ["posts", {post_id: "{literal-key}"}], {text: "explicit key"});
});
