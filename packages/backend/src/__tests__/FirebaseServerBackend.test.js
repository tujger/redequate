import ExtraListener from "../common/handlers/extra";
import BackendBase from "../common/BackendBase";
import FirebaseServerBackend from "../firebase-server/src/database/FirebaseServerBackend";

let backend, getDatabase, createIncrement, database, references, records, generated;
const reference = path => {
    path ??= "";
    if (references.has(path)) return references.get(path);
    const ref = {
        key: path.split("/").at(-1) || null,
        child: vi.fn(key => reference(`${path}/${key}`)),
        push: vi.fn(() => reference(`${path}/-generated-${++generated}`)),
        get: vi.fn(async () => ({val: () => records.get(path) ?? null})),
        set: vi.fn(async value => { records.set(path, value); }),
        update: vi.fn(async () => {}),
        remove: vi.fn(async () => { records.delete(path); }),
        transaction: vi.fn(async callback => {
            const value = callback(records.get(path) ?? null);
            if (value === undefined) return {committed: false};
            records.set(path, value);
            return {committed: true};
        }),
    };
    references.set(path, ref);
    return ref;
};
beforeEach(() => {
    references = new Map(); records = new Map(); generated = 0;
    database = {ref: vi.fn(reference)};
    getDatabase = vi.fn(() => database);
    createIncrement = vi.fn(n => ({".sv": {increment: n}}));
    backend = new FirebaseServerBackend(getDatabase, createIncrement);
});

it("inherits BackendBase and delegates native increments without opening a database", () => {
    expect(backend).toBeInstanceOf(BackendBase);
    const marker = backend.increment(-2);
    expect(marker).toBe(createIncrement.mock.results[0].value);
    expect(createIncrement).toHaveBeenCalledExactlyOnceWith(-2);
    expect(getDatabase).not.toHaveBeenCalled();
});

it("creates at a generated key without injecting the key into the record", async () => {
    const value = {text: "created"};
    expect(await backend.request("database.create", ["posts", "post_id"], value)).toBe("-generated-1");
    expect(records.get("posts/-generated-1")).toBe(value);
    expect(reference("posts").push).toHaveBeenCalledTimes(1);
    expect(reference("posts/-generated-1").transaction).toHaveBeenCalledWith(expect.any(Function), undefined, false);
    expect(value).toEqual({text: "created"});
});

it("creates with an explicit key under a resolved parent path", async () => {
    const value = {text: "hello"};
    expect(await backend.request("database.create", ["chats", {chat_id: "c1"}, {message_id: "m1"}], value)).toBe("m1");
    expect(records.get("chats/c1/m1")).toBe(value);
    expect(reference("chats/c1").push).not.toHaveBeenCalled();
});

it("does not overwrite an existing record", async () => {
    records.set("posts/p1", {text: "original"});
    await expect(backend.request("database.create", ["posts", {post_id: "p1"}], {text: "new"}))
        .rejects.toMatchObject({code: "database/conflict"});
    expect(records.get("posts/p1")).toEqual({text: "original"});
    expect(reference("posts/p1").set).not.toHaveBeenCalled();
});

it("uses atomic creation for competing requests to the same key", async () => {
    const results = await Promise.allSettled([1, 2].map(n => backend.request("database.create", ["posts", {post_id: "p1"}], {n})));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(reference("posts/p1").transaction).toHaveBeenCalledTimes(2);
});

it.each([0, false, null, [1, 2], {text: "complete"}])("fully replaces the resolved path with %j", async value => {
    records.set("posts/p1", {obsolete: true});
    expect(await backend.request("database.update", ["posts", {post_id: "p1"}], value)).toBeNull();
    expect(reference("posts/p1").set).toHaveBeenCalledExactlyOnceWith(value);
    expect(records.get("posts/p1")).toEqual(value);
});

it("passes native increments to set without reading or interpreting them", async () => {
    const marker = backend.increment(2);
    expect(await backend.request("database.update", ["_counters", {id: "p"}, "likes"], marker)).toBeNull();
    expect(reference("_counters/p/likes").set).toHaveBeenCalledExactlyOnceWith(marker);
    expect(reference("_counters/p/likes").transaction).not.toHaveBeenCalled();
});

it.each(["", []])("applies root object batches with update for %j", async path => {
    const changes = {"posts/p1": {text: "new"}, "roles/u1": null};
    expect(await backend.request("database.update", path, changes)).toBeNull();
    expect(reference("").update).toHaveBeenCalledExactlyOnceWith(changes);
});

it("normalizes named Map paths for one root batch", async () => {
    const marker = backend.increment(1);
    expect(await backend.request("database.update", "", new Map([
        [["posts", {post_id: "p1"}], {text: "new"}],
        [["_counters", {id: "total"}, "posts"], marker],
    ]))).toBeNull();
    expect(reference("").update).toHaveBeenCalledExactlyOnceWith({"posts/p1": {text: "new"}, "_counters/total/posts": marker});
});

it.each([true, false])("deletes an existing or missing record (exists: %s)", async exists => {
    if (exists) records.set("posts/p1", {text: "old"});
    expect(await backend.request("database.delete", ["posts", {post_id: "p1"}])).toBeNull();
    expect(reference("posts/p1").remove).toHaveBeenCalledExactlyOnceWith();
    expect(records.has("posts/p1")).toBe(false);
});

it.each([
    ["database.create"], ["database.create", ["posts", "post_id"]],
    ["database.create", ["posts", "post_id"], null], ["database.create", ["posts", "post_id"], []],
    ["database.create", ["posts", {post_id: "bad/key"}], {}],
    ["database.create", ["posts", "post_id"], {}, {}],
    ["database.update", "posts/p1"], ["database.update", "posts/p1", {}, {}],
    ["database.update", "", false], ["database.update", "", []],
    ["database.read"], ["database.read", "posts/p1", {}],
    ["database.delete"], ["database.delete", "posts/p1", null],
])("rejects malformed arguments %j without writing", async (...args) => {
    await expect(backend.request(...args)).rejects.toMatchObject({code: "database/invalid-argument"});
    for (const ref of references.values()) {
        expect(ref.transaction).not.toHaveBeenCalled();
        expect(ref.set).not.toHaveBeenCalled();
        expect(ref.update).not.toHaveBeenCalled();
        expect(ref.remove).not.toHaveBeenCalled();
    }
});

it.each(["database.watch", "unknown", "toString"])("rejects unsupported %s before opening a database", async name => {
    await expect(backend.request(name, "posts/p1", {})).rejects.toMatchObject({code: "backend/not-implemented"});
    expect(getDatabase).not.toHaveBeenCalled();
});

it.each([
    ["database.create", "transaction", [["posts", {post_id: "p1"}], {text: "new"}]],
    ["database.update", "set", [["posts", {post_id: "p1"}], {text: "new"}]],
    ["database.read", "get", [["posts", {post_id: "p1"}]]],
    ["database.delete", "remove", [["posts", {post_id: "p1"}]]],
])("propagates SDK failures from %s", async (name, method, args) => {
    const failure = new Error("SDK unavailable");
    reference("posts/p1")[method].mockRejectedValueOnce(failure);
    await expect(backend.request(name, ...args)).rejects.toBe(failure);
});


it.each(["author", 0, false, null])("reads a resolved path without losing %j", async value => {
    records.set("posts/p1/uid", value);
    expect(await backend.request("database.read", ["posts", {post_id: "p1"}, "uid"])).toBe(value);
    expect(reference("posts/p1/uid").get).toHaveBeenCalledExactlyOnceWith();
});


it("runs ExtraListener through Admin reads, native counter writes and alert creation", async () => {
    records.set("posts/p1/uid", "author");
    await new ExtraListener(backend).onCreate({
        value: {id: "p1", uid: "reactor", type: "like"}, params: {extra_id: "e1"},
    });
    expect(reference("_counters/p1/like").set).toHaveBeenCalledExactlyOnceWith({".sv": {increment: 1}});
    expect(reference("posts/p1/uid").get).toHaveBeenCalledTimes(1);
    expect(records.get("alerts/author/-generated-1")).toEqual({
        uid: "reactor", context: null, id: "p1", message: null,
        new: true, path: null, timestamp: backend.TIMESTAMP, type: "like",
    });
});
