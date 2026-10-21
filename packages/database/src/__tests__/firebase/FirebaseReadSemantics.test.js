import {vi} from "vitest";
import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

let fixture, database;
beforeEach(() => {
    fixture = createFirebase();
    database = new FirebaseDatabase({firebase: fixture.firebase});
});

it("reads every path exactly, including literal strings and nested fields", async () => {
    for (const [path, address, value] of [
        [["meta", {"settings": "settings"}], "meta/settings", {theme: "dark"}],
        [["posts", {"post_id": "post_id"}], "posts/post_id", false],
        [["posts"], "posts", {p: {created: 1}}],
        [["posts", {post_id: "p"}], "posts/p", {created: 1}],
        [["posts", {post_id: "p"}, {"owner_id": "owner_id"}], "posts/p/owner_id", {id: "u", roles: ["a"]}],
        [["posts", {post_id: "p"}, {"id": "id"}], "posts/p/id", ["one", "two"]],
        [["posts", {post_id: "p"}, {"comments": "comments"}], "posts/p/comments", {c: {created: 2}}],
        [["posts", {post_id: "p"}, "comments", {comment_id: "c"}, {"post_id": "post_id"}],
            "posts/p/comments/c/post_id", false]
    ]) {
        fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot(value));
        expect(await database.read(path)).toEqual(value);
        expect(fixture.sdk.once.mock.calls.at(-1)[0].path).toBe(address);
    }
});

it("queries all matching records with inclusive bounds and descending order", async () => {
    const values = {a: {created: 100}, b: {created: 150}, c: {created: 200}, d: {created: 250}};
    fixture.sdk.once.mockResolvedValue(fixture.snapshot(values));
    const path = ["posts", {post_id: "p"}, "comments"];
    expect(await database.read(path, {orderBy: "created", order: "desc", start: 100, end: 200}))
        .toEqual({c: values.c, b: values.b, a: values.a});
    expect(fixture.sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["created"],
        startAt: [100], endAt: [200]});
    expect(await database.read(path, {orderBy: "created", equalTo: 150})).toEqual({b: values.b});
    expect(fixture.sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByChild: ["created"], equalTo: [150]});
    await database.read(["posts"], {orderBy: "created", start: 100, end: 200});
    expect(fixture.sdk.once.mock.calls.at(-1)[0].path).toBe("posts");
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot(null));
    expect(await database.read(path)).toBeUndefined();
});

it("compares immediate child values, keys and record fields", async () => {
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({a: "active", b: "idle", c: "active"}));
    expect(await database.read(["posts", {post_id: "p"}, {"states": "states"}], {equalTo: "active"}))
        .toEqual({a: "active", c: "active"});
    expect(fixture.sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByValue: [], equalTo: ["active"]});
    expect(await database.read("states", {orderBy: "", equalTo: "active"}))
        .toEqual({a: "active", c: "active"});
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({"2": "a", "10": "b", "02": "c", z: "d"}));
    expect(await database.read("keys", {start: "2", end: "10"}))
        .toEqual({"2": "a", "10": "b", "02": "c"});
    expect(fixture.sdk.once.mock.calls.at(-1)[0].query).toEqual({orderByKey: [], startAt: ["2"], endAt: ["10"]});
    expect(await database.read("keys", {start: "02", end: "z", order: "desc"}))
        .toEqual({"02": "c", "10": "b", z: "d"});
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({first: {created: "active"}, second: {created: "idle"}}));
    expect(await database.read(["posts", {post_id: "p"}], {orderBy: "created", equalTo: "active"}))
        .toEqual({first: {created: "active"}});
});

it("validates queries and routes storage failures through onError", async () => {
    await expect(database.read(["posts", {"key": "key"}], {order: "backward"}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.read(["posts", {"key": "key"}], {equalTo: 1, start: 0}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    const failure = new Error("offline"), onError = vi.fn();
    fixture.sdk.once.mockRejectedValueOnce(failure);
    expect(await database.read(["posts", {"key": "key"}], {onError})).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(failure, "read", expect.objectContaining({path: ["posts", {key: "key"}]}));
});

it("omits the identity field only for array reads and queries extras at their indexed root", async () => {
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({e1: {id_uid: "post_user", type: "like"}}));
    expect(await database.read(["extra", "extra_id"], {orderBy: "id_uid", equalTo: "post_user"}))
        .toEqual({e1: {id_uid: "post_user", type: "like"}});
    expect(fixture.sdk.once.mock.calls.at(-1)[0]).toMatchObject({path: "extra", query: {orderByChild: ["id_uid"], equalTo: ["post_user"]}});
    await database.read(["users_public", "user_id"]);
    expect(fixture.sdk.once.mock.calls.at(-1)[0].path).toBe("users_public");
    await database.read(["users_public", {user_id: "u1"}, "device_id"]);
    expect(fixture.sdk.once.mock.calls.at(-1)[0].path).toBe("users_public/u1");
    await database.read("extra/extra_id");
    expect(fixture.sdk.once.mock.calls.at(-1)[0].path).toBe("extra/extra_id");
});
