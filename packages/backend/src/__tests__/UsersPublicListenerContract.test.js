import UserListener from "../common/handlers/users_public";

const params = {user_id: "gone"};
const value = {name: "Deleted"};
const cursorPaths = [
    [["posts", "post_id"], {orderBy: ["uid"], equalTo: "gone"}],
    [["extra", "extra_id"], {orderBy: ["uid"], equalTo: "gone"}],
    [["mutual", "mutual_type", "mutual_id"], {orderBy: ["uid"], equalTo: "gone"}],
    [["mutualrequests", "mutual_type", "mutual_id"], {orderBy: ["uid"], equalTo: "gone"}],
    [["mutualrequests", "mutual_type", "mutual_id"], {orderBy: ["id"], equalTo: "gone"}],
    [["mutualstamps", "mutual_type", {user_id: "gone"}, "mutual_id"], {}],
    [["mutualstamps", "mutual_type", "user_id", "mutual_id"], {equalTo: "gone"}],
];

const setup = () => {
    const cursors = [];
    const backend = {
        TIMESTAMP: 123,
        getCurrentUser: vi.fn(async () => "admin"),
        request: vi.fn(async (name, path) => {
            if (name === "database.cursor") {
                const cursor = {next: vi.fn(async () => [])};
                cursors.push(cursor);
                return cursor;
            }
            if (name === "database.update" || name === "database.create") return undefined;
            throw new Error(`Unexpected request: ${name} ${JSON.stringify(path)}`);
        }),
    };
    return {backend, cursors, listener: new UserListener(backend)};
};

it("has no create or update side effects", async () => {
    const {backend, listener} = setup();
    await listener.onCreate({params, value});
    await listener.onUpdate({params, previous: {name: "Before"}, value});
    expect(backend.request).not.toHaveBeenCalled();
    expect(backend.getCurrentUser).not.toHaveBeenCalled();
});

it("removes direct user records and queries every cleanup path with exact cursor options", async () => {
    const {backend, cursors, listener} = setup();
    await listener.onDelete({params, value});

    const calls = backend.request.mock.calls;
    expect(calls[0][0]).toBe("database.update");
    expect(calls[0][1]).toBe("");
    expect(calls[0][2]).toBeInstanceOf(Map);
    expect([...calls[0][2]]).toEqual([
        [["_counters", {id: "gone"}], null],
        [["_chats", {user_id: "gone"}], null],
        [["roles", {user_id: "gone"}], null],
        [["users_private", {user_id: "gone"}], null],
    ]);

    expect(calls.slice(1, 8)).toHaveLength(cursorPaths.length);
    cursorPaths.forEach(([path, query], index) => {
        const [name, actualPath, options] = calls[index + 1];
        expect(name).toBe("database.cursor");
        expect(actualPath).toEqual(path);
        expect(Object.keys(options).sort()).toEqual([...Object.keys(query), "handle"].sort());
        expect(options).toMatchObject(query);
        expect(options.handle).toBeInstanceOf(Function);
        expect(options.handle({key: "record", value: {uid: "gone"}})).toBeNull();
        expect(cursors[index].next).toHaveBeenCalledExactlyOnceWith(1000);
    });
    expect(calls[8]).toEqual(["database.create", ["activity", "activity_id"], {
        uid: "admin", type: "user.delete", details: {uid: "gone", public: value}, timestamp: 123,
    }]);
    expect(calls).toHaveLength(9);
});
