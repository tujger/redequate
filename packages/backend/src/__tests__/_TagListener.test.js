import TagListener from "../common/handlers/_tag";

const params = {tag_id: "tag", post_id: "post"};
const stamp = (type, uid) => ["mutualstamps", {mutual_type: type}, {user_id: uid}, {mutual_id: "post"}];

const setup = ({post = {uid: "author"}, subscribers = ["alice", "bob"], existing = []} = {}) => {
    const values = new Map(existing.map(([type, uid, value]) => [JSON.stringify(stamp(type, uid)), value]));
    const cursor = {next: vi.fn(async () => subscribers.map(uid => ({value: {uid, id: "tag"}})))};
    const backend = {
        TIMESTAMP: 123,
        getCurrentUser: vi.fn(async () => "admin"),
        request: vi.fn(async (name, path, value, options) => {
            if (name === "database.read") return post;
            if (name === "database.cursor") return cursor;
            if (name === "database.create") return "error-id";
            if (name === "database.update") {
                const key = JSON.stringify(path);
                if (options.mode === "read") return {value: values.get(key) ?? null, etag: "etag"};
                if (options.mode === "replace") {
                    values.set(key, value);
                    return {committed: true, value};
                }
            }
            throw new Error(`Unexpected request: ${name}`);
        }),
    };
    return {backend, cursor, values, listener: new TagListener(backend)};
};

it.each([null, {uid: "author", to: "parent"}])("skips missing posts and replies: %j", async post => {
    const {backend, listener} = setup({post});
    await listener.onCreate({params, value: "author"});
    expect(backend.request.mock.calls).toEqual([["database.read", ["posts", {post_id: "post"}]]]);
});

it("queries watching subscriptions and stamps both types without replacing existing stamps", async () => {
    const {backend, cursor, values, listener} = setup({existing: [["watching", "alice", "old"]]});
    await listener.onCreate({params, value: "author"});
    expect(backend.request.mock.calls.slice(0, 2)).toEqual([
        ["database.read", ["posts", {post_id: "post"}]],
        ["database.cursor", ["mutual", {mutual_type: "watching"}, "mutual_id"],
            {equalTo: "tag", orderBy: ["id"]}],
    ]);
    expect(cursor.next).toHaveBeenCalledExactlyOnceWith(1000);
    for (const uid of ["alice", "bob"]) for (const type of ["watching", "_"]) {
        expect(backend.request).toHaveBeenCalledWith("database.update", stamp(type, uid), null, {mode: "read"});
        expect(values.get(JSON.stringify(stamp(type, uid)))).toBe(uid === "alice" && type === "watching" ? "old" : "author");
    }
    expect(backend.request.mock.calls.filter(([name, path, , options]) =>
        name === "database.update" && JSON.stringify(path) === JSON.stringify(stamp("watching", "alice")) &&
        options.mode === "replace")).toHaveLength(0);
});

it("records one subscriber's failure and continues with the next subscriber", async () => {
    const {backend, listener, values} = setup();
    const original = backend.request.getMockImplementation();
    backend.request.mockImplementation((name, path, ...args) =>
        name === "database.update" && JSON.stringify(path) === JSON.stringify(stamp("watching", "alice"))
            ? Promise.reject(new Error("stamp failed")) : original(name, path, ...args));
    await listener.onCreate({params, value: "author"});
    expect(backend.request).toHaveBeenCalledWith("database.create", ["errors", "error_id"],
        {error: "stamp failed", timestamp: 123, uid: "admin"});
    expect(values.has(JSON.stringify(stamp("_", "alice")))).toBe(false);
    expect(values.get(JSON.stringify(stamp("watching", "bob")))).toBe("author");
    expect(values.get(JSON.stringify(stamp("_", "bob")))).toBe("author");
});

it("does not write on update or delete", async () => {
    const {backend, listener} = setup();
    await listener.onUpdate({params, previous: "before", value: "after"});
    await listener.onDelete({params, value: "after"});
    expect(backend.request).not.toHaveBeenCalled();
});
