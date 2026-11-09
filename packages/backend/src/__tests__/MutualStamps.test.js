import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import MutualStampListener, {createMutualStamps, deleteMutualStamps} from "../common/handlers/mutualstamps";

const args = {userId: "author", mutualId: "post"};
const address = path => typeof path === "string"
    ? path
    : path.map(segment =>
        typeof segment === "string" ? segment : Object.values(segment)[0]).join("/");
const stampPath = (type, user) => ["mutualstamps", {mutual_type: type}, {user_id: user}, {mutual_id: "post"}];
const counterPath = (type, user) => ["_counters", {id: user}, "mutualstamps", {mutual_type: type}];

function setup(types = ["following", "friend"]) {
    const cursors = new Map(types.map(type => [type, {
        next: vi.fn().mockResolvedValue([
            {key: "relation", value: {uid: "reader", id: "author"}},
            {key: "self", value: {uid: "author", id: "author"}}
        ])
    }]));
    const backend = {
        request: vi.fn(async (name, path) => {
            if (name === "database.read") return types;
            if (name === "database.cursor") return cursors.get(path[1].mutual_type);
        })
    };
    return {backend, cursors};
}

it.each([["create", createMutualStamps, "author"], ["delete", deleteMutualStamps, null]])(
    "%s distributes stamps to the author and matching recipients", async (name, operation, payload) => {
        const {backend, cursors} = setup();
        await operation(backend, args);
        expect(backend.request.mock.calls[0]).toEqual(["database.read", ["mutual", "mutual_type"], {shallow: true}]);
        for (const [type, cursor] of cursors) {
            expect(backend.request).toHaveBeenCalledWith("database.cursor", ["mutual", {mutual_type: type}, "mutual_id"],
                {orderBy: ["id"], equalTo: "author"});
            expect(cursor.next).toHaveBeenCalledWith(10000);
        }
        const writes = backend.request.mock.calls.filter(([method]) => method === "database.update");
        expect(writes).toHaveLength(1);
        expect(writes[0][1]).toBe("");
        expect(writes[0][2]).toBeInstanceOf(Map);
        const entries = new Map([...writes[0][2]].map(([path, value]) => [address(path), value]));
        expect(entries).toEqual(new Map([
            ["mutualstamps/_my/author/post", payload],
            ["mutualstamps/_/reader/post", payload],
            ["mutualstamps/following/reader/post", payload],
            ["mutualstamps/friend/reader/post", payload]
        ]));
    });

it.each([createMutualStamps, deleteMutualStamps])("rejects absent mutualId before database access", async operation => {
    for (const mutualId of [null, undefined]) {
        const {backend} = setup();
        await expect(operation(backend, {...args, mutualId})).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(backend.request).not.toHaveBeenCalled();
    }
});

it("creates the author's stamp when an existing type has no matching recipients", async () => {
    const {backend, cursors} = setup(["following"]);
    cursors.get("following").next.mockResolvedValue([]);
    await createMutualStamps(backend, args);
    const batch = backend.request.mock.calls.at(-1)[2];
    expect([...batch].map(([path, value]) => [address(path), value])).toEqual([["mutualstamps/_my/author/post", "author"]]);
});

it.each(["database.read", "database.cursor", "next", "database.update"])("propagates %s failures", async stage => {
    const {backend, cursors} = setup(["following"]);
    const error = new Error(`${stage} failed`);
    if (stage === "next") cursors.get("following").next.mockRejectedValue(error);
    else {
        const invoke = backend.request.getMockImplementation();
        backend.request.mockImplementation((name, ...rest) => name === stage ? Promise.reject(error) : invoke(name, ...rest));
    }
    await expect(createMutualStamps(backend, args)).rejects.toBe(error);
    if (stage !== "database.update") expect(backend.request.mock.calls.some(([name]) => name === "database.update")).toBe(false);
});

it("counts only create/delete events and leaves updates alone", async () => {
    let value = null;
    const backend = {
        request: vi.fn(async (name, path, next, options) => {
            expect(name).toBe("database.update");
            expect(path).toEqual(counterPath("following", "reader"));
            if (options.mode === "read") return {value, etag: "counter"};
            value = next;
            return {committed: true, value};
        })
    };
    const listener = new MutualStampListener(backend);
    const event = {params: {mutual_type: "following", user_id: "reader", mutual_id: "post"}, value: "author"};
    expect(listener.path).toEqual(["mutualstamps", "mutual_type", "user_id", "mutual_id"]);
    await listener.onCreate(event);
    expect(value).toBe(1);
    backend.request.mockClear();
    await listener.onUpdate({...event, previous: "old-author"});
    expect(backend.request).not.toHaveBeenCalled();
    expect(value).toBe(1);
    await listener.onDelete(event);
    expect(value).toBeNull();
});

it("propagates listener counter failures", async () => {
    const error = new Error("counter failed");
    const listener = new MutualStampListener({request: vi.fn().mockRejectedValue(error)});
    const event = {params: {mutual_type: "following", user_id: "reader", mutual_id: "post"}, value: "author"};
    await expect(listener.onCreate(event)).rejects.toBe(error);
    await expect(listener.onDelete(event)).rejects.toBe(error);
});

let sequence = 0;
it("LocalBackend counts stamp creation once, ignores replacement and clears counters on deletion", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storageId = `mutual-stamps-${++sequence}`;
        const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId});
        database.setBackend(backend);
        backend.setDatabase(database);
        await database.read(["mutualstamps"]);
        const batch = new Map([["_my", "author"], ["_", "reader"], ["following", "reader"]]
            .map(([type, user]) => [stampPath(type, user), "author"]));
        await backend.request("database.update", "", batch);
        for (const [type, user] of [["_my", "author"], ["_", "reader"], ["following", "reader"]]) {
            await vi.waitFor(async () => expect(await database.read(counterPath(type, user))).toBe(1));
            expect(await database.read(stampPath(type, user))).toBe("author");
        }
        await backend.request("database.update", "", batch);
        await backend.request("database.update", "", new Map([[stampPath("following", "reader"), "replacement"]]));
        expect(await database.read(counterPath("following", "reader"))).toBe(1);
        await backend.request("database.update", "", new Map([...batch.keys()].map(path => [path, null])));
        for (const [type, user] of [["_my", "author"], ["_", "reader"], ["following", "reader"]]) {
            await vi.waitFor(async () => expect(await database.read(counterPath(type, user))).toBeUndefined());
            expect(await database.read(stampPath(type, user))).toBeUndefined();
        }
    } finally { vi.unstubAllGlobals(); }
});

it("deduplicates stamps and counters through the real LocalBackend across repeated recipients and types", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storageId = `mutual-stamps-distribution-${++sequence}`;
        const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId});
        database.setBackend(backend);
        backend.setDatabase(database);
        await database.read(["mutualstamps"]);
        for (const type of ["following", "friend"]) {
            for (const mutual_id of ["relation-1", "relation-2"]) {
                await database.create(["mutual", {mutual_type: type}, {mutual_id}], {uid: "reader", id: "author"});
            }
        }
        const targets = [["_my", "author"], ["_", "reader"], ["following", "reader"], ["friend", "reader"]];
        await createMutualStamps(backend, args);
        for (const [type, user] of targets) {
            expect(await database.read(stampPath(type, user))).toBe("author");
            await vi.waitFor(async () => expect(await database.read(counterPath(type, user))).toBe(1));
        }
        await createMutualStamps(backend, args);
        for (const [type, user] of targets) expect(await database.read(counterPath(type, user))).toBe(1);
        await deleteMutualStamps(backend, args);
        for (const [type, user] of targets) {
            expect(await database.read(stampPath(type, user))).toBeUndefined();
            await vi.waitFor(async () => expect(await database.read(counterPath(type, user))).toBeUndefined());
        }
    } finally { vi.unstubAllGlobals(); }
});

it.each([createMutualStamps, deleteMutualStamps])("deduplicates full stamp addresses across types and repeated recipients", async operation => {
    const {backend, cursors} = setup();
    for (const cursor of cursors.values()) {
        cursor.next.mockResolvedValue(Array.from({length: 2}, () => ({value: {uid: "reader", id: "author"}})));
    }
    await operation(backend, args);
    const batch = backend.request.mock.calls.at(-1)[2];
    expect([...batch.keys()]).toEqual([
        stampPath("_my", "author"), stampPath("_", "reader"),
        stampPath("following", "reader"), stampPath("friend", "reader")
    ]);
    const addresses = [...batch.keys()].map(address);
    expect(addresses).toEqual([
        "mutualstamps/_my/author/post", "mutualstamps/_/reader/post",
        "mutualstamps/following/reader/post", "mutualstamps/friend/reader/post"
    ]);
});

it.each([createMutualStamps, deleteMutualStamps])("writes the author stamp without any mutual types", async operation => {
    const {backend} = setup([]);
    await operation(backend, args);
    const batch = backend.request.mock.calls.at(-1)[2];
    expect([...batch.keys()].map(address)).toEqual(["mutualstamps/_my/author/post"]);
});
