import {IDBFactory} from "fake-indexeddb";
import PostListener from "../common/handlers/post";
import LocalBackend from "../local";
import LocalDatabase from "../../../database/src/local";

const params = {post_id: "new"};
const key = path => JSON.stringify(path);
const postPath = id => ["posts", {post_id: id}];
const counterPath = (id, name) => ["_counters", {id}, name];
const setup = (post = {uid: "writer", to: "parent", text: "keep", nested: {flag: true}}, parentUid = "parent-author", rootUid = "root-author") => {
    const records = new Map([
        [key(postPath("new")), post],
        [key(postPath("parent")), {uid: parentUid, to: "middle"}],
        [key(postPath("middle")), {uid: "middle-author", to: "root"}],
        [key(postPath("root")), {uid: rootUid, text: "root content"}],
    ]);
    const alerts = [];
    const backend = {TIMESTAMP: 123, request: vi.fn(async (name, path, value, options) => {
        if (name === "database.read") return records.get(key(path)) ?? null;
        if (name === "database.create") { alerts.push({path, value}); return `alert-${alerts.length}`; }
        if (options.mode === "read") return {value: records.get(key(path)) ?? null, etag: "initial"};
        records.set(key(path), value);
        return {committed: true, value};
    })};
    return {backend, records, alerts, listener: new PostListener(backend), post,
        counter: (id, name) => records.get(key(counterPath(id, name)))};
};

it("counts ordinary posts without processing ancestors or alerts", async () => {
    const {listener, backend, counter, alerts} = setup({uid: "writer", text: "top-level"});
    await listener.onCreate({params, value: {uid: "writer", text: "top-level"}});
    expect(counter("total", "posts")).toBe(1);
    expect(counter("writer", "posts")).toBe(1);
    expect(backend.request.mock.calls.map(([name]) => name)).toEqual(Array(4).fill("database.update"));
    expect(alerts).toEqual([]);
});

it.each([
    ["parent-author", "root-author", ["parent-author", "root-author"]],
    ["owner", "owner", ["owner"]],
    ["writer", "root-author", ["root-author"]],
    ["parent-author", "writer", ["parent-author"]],
    ["writer", "writer", []],
])("notifies parent %s and root %s once, excluding the writer", async (parentUid, rootUid, recipients) => {
    const {listener, backend, post, records, counter, alerts} = setup(undefined, parentUid, rootUid);
    await listener.onCreate({params, value: post});
    expect(backend.request.mock.calls.filter(([name]) => name === "database.read").map(([, path]) => path))
        .toEqual([postPath("parent"), postPath("middle"), postPath("root")]);
    expect(counter("writer", "replies")).toBe(1);
    expect(counter("root", "replied")).toBe(1);
    expect(counter("total", "posts")).toBeUndefined();
    expect(counter("writer", "posts")).toBeUndefined();
    expect(counter(parentUid, "replied")).toBe(parentUid === "writer" ? undefined : 1);
    expect(counter("middle-author", "replied")).toBeUndefined();
    expect(alerts.map(({path}) => path[1].user_id)).toEqual(recipients);
    for (const {value} of alerts) expect(value).toEqual({uid: "writer", type: "replies", id: "new", context: "root",
        message: null, path: null, new: true, timestamp: 123});
    expect(records.get(key(postPath("new")))).toEqual({...post, root: "root"});
});

it("handles a direct reply without duplicating the root author's alert", async () => {
    const {listener, post, counter, alerts, records} = setup({uid: "writer", to: "root", text: "direct"});
    await listener.onCreate({params, value: post});
    expect(counter("writer", "replies")).toBe(1);
    expect(counter("root-author", "replied")).toBe(1);
    expect(counter("root", "replied")).toBe(1);
    expect(alerts).toHaveLength(1);
    expect(records.get(key(postPath("new")))).toEqual({...post, root: "root"});
});

it.each(["missing", "new", "cycle"])("rejects %s ancestors before writing", async kind => {
    const {listener, records, backend} = setup();
    if (kind === "cycle") records.set(key(postPath("root")), {uid: "root-author", to: "parent"});
    const post = {uid: "writer", to: kind === "cycle" ? "parent" : kind};
    await expect(listener.onCreate({params, value: post})).rejects.toThrow(kind === "missing" ? "Not found post missing" : "Cyclic post chain");
    expect(backend.request.mock.calls.every(([name]) => name === "database.read")).toBe(true);
});

it.each([1, 4, 6, 8, 9, 11, 13])("stops and propagates a backend error at operation %s", async operation => {
    const {listener, backend, post} = setup();
    const invoke = backend.request.getMockImplementation();
    const failure = new Error("backend failed"); let calls = 0;
    backend.request.mockImplementation((...args) => ++calls === operation ? Promise.reject(failure) : invoke(...args));
    await expect(listener.onCreate({params, value: post})).rejects.toBe(failure);
    expect(backend.request).toHaveBeenCalledTimes(operation);
});

it("creates replies and alerts through LocalBackend while preserving complete posts", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storageId = "post-replies";
        const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId, backend});
        await database.read(["posts"]);
        await database.create(postPath("root"), {uid: "root-author", text: "root content"});
        await vi.waitFor(async () => expect(await backend.request("database.read", counterPath("total", "posts"))).toBe(1));
        await database.create(postPath("parent"), {uid: "parent-author", to: "root", text: "parent content"});
        await vi.waitFor(async () => expect(await backend.request("database.read", counterPath("root", "replied"))).toBe(1));
        const reply = {uid: "writer", to: "parent", text: "reply content", images: ["keep"]};
        await database.create(postPath("new"), reply);
        await vi.waitFor(async () => {
            expect(await backend.request("database.read", counterPath("root", "replied"))).toBe(2);
            const rootAlerts = await database.read(["alerts", {user_id: "root-author"}, "alert_id"]);
            expect(Object.values(rootAlerts ?? {}).filter(alert => alert.id === "new")).toHaveLength(1);
        });
        expect(await database.read(postPath("new"))).toEqual({...reply, root: "root"});
        expect(await database.read(postPath("parent"))).toEqual({uid: "parent-author", to: "root", text: "parent content", root: "root"});
        expect(await backend.request("database.read", counterPath("total", "posts"))).toBe(1);
        expect(await backend.request("database.read", counterPath("writer", "replies"))).toBe(1);
        expect(await backend.request("database.read", counterPath("parent-author", "replied"))).toBe(1);
        expect(await backend.request("database.read", counterPath("writer", "posts"))).toBeNull();
        const alerts = await database.read(["alerts", {user_id: "parent-author"}, "alert_id"]);
        expect(Object.values(alerts)).toEqual([expect.objectContaining({id: "new", uid: "writer", context: "root", type: "replies"})]);
    } finally { vi.unstubAllGlobals(); }
});
