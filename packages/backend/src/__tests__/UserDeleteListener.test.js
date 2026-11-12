import {IDBFactory} from "fake-indexeddb";
import createLocalDatabase from "../../../database/src/__tests__/createLocalDatabase";
import LocalBackend from "../local/LocalBackend";

// This suite exercises cleanup itself; downstream listeners have their own tests.
vi.mock("../local/database/installListeners", () => ({installListeners: vi.fn()}));

import UserListener from "../common/handlers/users_public";
import resolvePath from "../../../database/src/common/resolvePath";
import DatabaseCursor from "../../../database/src/common/DatabaseCursor";
import createCursor from "../common/helpers/createCursor";
import parsePath from "../../../database/src/firebase/parsePath";

const setup = data => {
    const get = path => path.split("/").filter(Boolean).reduce((node, key) => node?.[key], data) ?? null;
    const deleted = [];
    const setNull = path => {
        const keys = path.split("/");
        const parent = get(keys.slice(0, -1).join("/"));
        if (parent) delete parent[keys.at(-1)];
    };
    const backend = {
        TIMESTAMP: 123,
        getCurrentUser: vi.fn().mockResolvedValue("admin"),
        request: vi.fn(async (name, path, options) => {
            if (name === "database.create") return;
            if (name === "database.update") {
                if (path !== "") {
                    expect(options).toBeNull();
                    deleted.push(resolvePath(path));
                    setNull(resolvePath(path));
                    return;
                }
                for (const [target, value] of options) {
                    expect(value).toBeNull();
                    setNull(resolvePath(target));
                }
                return;
            }
            if (name === "database.read") {
                expect(options).toEqual({shallow: true});
                return Object.keys(get(parsePath(path, "collection").address) ?? {});
            }
            if (name === "database.delete") {
                const address = resolvePath(path);
                deleted.push(address);
                setNull(address);
                return;
            }
            if (name === "database.cursor") {
                class SourceCursor extends DatabaseCursor {
                    constructor(target, query) {
                        super(query, target);
                        this.query = query;
                    }
                    async next(size) {
                        if (!this.records) {
                            const walk = (segments, parent = "", params = {}) => {
                                if (!segments.length) return [{parent, params}];
                                const [segment, ...rest] = segments;
                                return typeof segment === "string"
                                    ? Object.keys(get(parent) ?? {}).flatMap(key =>
                                        walk(rest, `${parent}/${key}`, {...params, [segment]: key}))
                                    : walk(rest, `${parent}/${Object.values(segment)[0]}`, params);
                            };
                            this.records = walk(this.path.slice(1, -1), this.path[0]).flatMap(({parent, params}) =>
                                Object.entries(get(parent) ?? {}).filter(([, value]) =>
                                    this.query.equalTo === undefined ||
                                    (this.query.orderBy ? value[this.query.orderBy[0]] : value) === this.query.equalTo
                                ).map(([key, value]) => ({parent, key, value, params}))
                            );
                            this.offset = 0;
                        }
                        const page = [];
                        while (this.offset < this.records.length && page.length < size) {
                            const {parent, ...record} = this.records[this.offset++];
                            if (get(`${parent}/${record.key}`) === null) continue;
                            const replacement = await this.query.handle(record);
                            if (replacement === null) {
                                await backend.request("database.update", `${parent}/${record.key}`, null);
                            } else {
                                expect(replacement).toBeUndefined();
                                page.push(record);
                            }
                        }
                        this._position = {finished: this.offset >= this.records.length};
                        return page;
                    }
                }
                return createCursor([path, options ?? {}],
                    (target, query) => new SourceCursor(target, query), parsePath);
            }
            throw new Error(`Unexpected request: ${name}`);
        }),
    };
    return {backend, deleted, listener: new UserListener(backend)};
};
const run = listener => listener.onDelete({params: {user_id: "gone"}, value: {name: "Deleted"}});

it("cleans user relations, requests and authored stamps while preserving other users and chats", async () => {
    const outgoing = {uid: "gone", id: "reader", type: "users_public"};
    const incoming = {uid: "reader", id: "gone"};
    const unrelated = {uid: "reader", id: "other"};
    const data = {
        roles: {gone: "user", reader: "user"}, users_private: {gone: {}, reader: {}},
        _counters: {gone: {posts: 1}, reader: {posts: 2}},
        _chats: {gone: {chat: 1}, reader: {chat: 1}},
        chats: {chat: {"!meta": {members: {gone: 0, reader: 0}}, message: {uid: "gone"}}},
        posts: {own: {uid: "gone"}, keep: {uid: "reader"}},
        extra: {own: {uid: "gone"}, keep: {uid: "reader"}},
        mutual: {
            friend: {outgoing, incoming, unrelated, self: {uid: "gone", id: "gone"}},
            watching: {outgoing: {uid: "gone", id: "tag"}, tagCollision: {uid: "reader", id: "gone", type: "tag"}},
            custom: {tagCollision: {uid: "reader", id: "gone", type: "tag"}},
        },
        mutualrequests: {friend: {outgoing, incoming, unrelated}},
        mutualstamps: {
            watching: {gone: {keep: "reader"}, reader: {own: "gone", keep: "other"}},
            _: {gone: {own: "gone"}, reader: {own: "gone", keep: "other"}},
            _my: {gone: {own: "gone"}, reader: {keep: "reader"}},
        },
    };
    const chat = structuredClone(data.chats);
    const {listener, deleted, backend} = setup(data);
    await run(listener);
    expect(backend.request.mock.calls.filter(([name]) => name === "database.cursor")).toHaveLength(7);
    expect(backend.request.mock.calls.some(([name]) => name === "database.read")).toBe(false);
    expect(backend.request.mock.calls.some(([name]) => name === "database.delete")).toBe(false);
    expect(data.chats).toEqual(chat);
    expect(data._chats).toEqual({reader: {chat: 1}});
    expect(data.roles).toEqual({reader: "user"});
    expect(data.users_private).toEqual({reader: {}});
    expect(data._counters).toEqual({reader: {posts: 2}});
    expect(data.posts).toEqual({keep: {uid: "reader"}});
    expect(data.extra).toEqual({keep: {uid: "reader"}});
    expect(data.mutual.friend).toEqual({incoming, unrelated});
    expect(data.mutual.watching).toEqual({tagCollision: {uid: "reader", id: "gone", type: "tag"}});
    expect(data.mutual.custom).toEqual({tagCollision: {uid: "reader", id: "gone", type: "tag"}});
    expect(data.mutualrequests.friend).toEqual({unrelated});
    expect(data.mutualstamps).toEqual({
        watching: {gone: {}, reader: {keep: "other"}}, _: {gone: {}, reader: {keep: "other"}}, _my: {gone: {}, reader: {keep: "reader"}},
    });
    // Parallel incoming/outgoing cursors may both delete this same relation.
    expect(deleted).toContain("mutual/friend/self");
    await run(listener);
    expect(data.chats).toEqual(chat);
});

it("deletes more than 1000 matching records when all handles return null", async () => {
    const entries = value => Object.fromEntries(Array.from({length: 1001}, (_, i) => [`item${i}`, value]));
    const data = {
        posts: entries({uid: "gone"}), extra: entries({uid: "gone"}),
        mutual: {friend: entries({uid: "reader", id: "gone"})},
        mutualrequests: {friend: entries({uid: "gone", id: "reader"})},
        mutualstamps: {watching: {gone: entries("other"), reader: entries("gone")}},
    };
    const {listener} = setup(data);
    await run(listener);
    expect(data.posts).toEqual({});
    expect(data.extra).toEqual({});
    expect(data.mutual.friend).toEqual(entries({uid: "reader", id: "gone"}));
    expect(data.mutualrequests.friend).toEqual({});
    expect(data.mutualstamps.watching.gone).toEqual({});
    expect(data.mutualstamps.watching.reader).toEqual({});
});

it("handles missing collections", async () => {
    const {listener} = setup({});
    await expect(run(listener)).resolves.toBeUndefined();
});

it("propagates failed cleanup instead of recording successful deletion activity", async () => {
    const {listener, backend} = setup({posts: {own: {uid: "gone"}}});
    const invoke = backend.request.getMockImplementation();
    const error = new Error("delete failed");
    backend.request.mockImplementation((name, ...args) => name === "database.update" && args[0] !== ""
        ? Promise.reject(error) : invoke(name, ...args));
    await expect(run(listener)).rejects.toBe(error);
    expect(backend.request.mock.calls.some(([name]) => name === "database.create")).toBe(false);
});

it("cleans concrete paths through real LocalBackend reads, batches and cursors", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storageId = "user-delete-cursor-schema";
        const database = createLocalDatabase({storageId});
        await database.read(["posts"]);
        const local = new LocalBackend({storageId});
        await local.request("database.update", "", new Map([
            [["posts", {post_id: "own"}], {uid: "gone"}],
            [["posts", {post_id: "keep"}], {uid: "reader"}],
            [["extra", {extra_id: "own"}], {uid: "gone", id: "keep", type: "like"}],
            [["extra", {extra_id: "keep"}], {uid: "reader", id: "keep", type: "like"}],
            [["roles", {user_id: "gone"}], "user"],
            [["roles", {user_id: "reader"}], "user"],
            [["users_private", {user_id: "gone"}], {email: "gone@example.test"}],
            [["_counters", {id: "gone"}], {posts: 1}],
            [["_chats", {user_id: "gone"}, {chat_id: "chat"}], {private: "reader"}],
            [["_chats", {user_id: "reader"}, {chat_id: "chat"}], {private: "gone"}],
            [["mutual", {mutual_type: "friend"}, {mutual_id: "out"}], {uid: "gone", id: "reader"}],
            [["mutual", {mutual_type: "friend"}, {mutual_id: "in"}], {uid: "reader", id: "gone"}],
            [["mutual", {mutual_type: "friend"}, {mutual_id: "keep"}], {uid: "reader", id: "other"}],
            [["mutual", {mutual_type: "watching"}, {mutual_id: "out"}], {uid: "gone", id: "tag"}],
            [["mutual", {mutual_type: "watching"}, {mutual_id: "keep"}], {uid: "reader", id: "gone", type: "tag"}],
            [["mutualrequests", {mutual_type: "friend"}, {mutual_id: "out"}], {uid: "gone", id: "reader"}],
            [["mutualrequests", {mutual_type: "friend"}, {mutual_id: "in"}], {uid: "reader", id: "gone"}],
            [["mutualrequests", {mutual_type: "friend"}, {mutual_id: "keep"}], {uid: "reader", id: "other"}],
            [["mutualrequests", {mutual_type: "custom"}, {mutual_id: "out"}], {uid: "gone", id: "reader"}],
            [["mutualrequests", {mutual_type: "custom"}, {mutual_id: "in"}], {uid: "reader", id: "gone"}],
            [["mutualrequests", {mutual_type: "custom"}, {mutual_id: "keep"}], {uid: "reader", id: "other"}],
            [["mutualstamps", {mutual_type: "watching"}, {user_id: "gone"}, {mutual_id: "own"}], "other"],
            [["mutualstamps", {mutual_type: "watching"}, {user_id: "reader"}, {mutual_id: "own"}], "gone"],
            [["mutualstamps", {mutual_type: "watching"}, {user_id: "reader"}, {mutual_id: "keep"}], "other"],
        ]));
        // Run real batch cleanup, shallow reads and cursor writes; omit activity creation.
        const backend = {
            TIMESTAMP: local.TIMESTAMP,
            getCurrentUser: async () => "admin",
            request: vi.fn((name, ...args) => name === "database.create"
                ? Promise.resolve() : local.request(name, ...args)),
        };
        await run(new UserListener(backend));
        expect(await database.read(["posts", "post_id"])).toEqual({keep: {uid: "reader"}});
        expect(await database.read(["extra", "extra_id"])).toEqual({
            keep: {uid: "reader", id: "keep", type: "like"},
        });
        expect(await database.read(["roles", {user_id: "gone"}])).toBeUndefined();
        expect(await database.read(["roles", {user_id: "reader"}])).toBe("user");
        expect(await database.read(["users_private", {user_id: "gone"}])).toBeUndefined();
        expect(await database.read(["_counters", {id: "gone"}])).toBeUndefined();
        expect(await database.read(["_chats", {user_id: "gone"}, "chat_id"])).toBeUndefined();
        expect(await database.read(["_chats", {user_id: "reader"}, {chat_id: "chat"}])).toBeDefined();
        for (const collection of ["mutual", "mutualrequests"]) {
            const rows = await database.read([collection, {mutual_type: "friend"}, "mutual_id"]);
            expect(Object.keys(rows).sort()).toEqual(collection === "mutual" ? ["in", "keep"] : ["keep"]);
        }
        const requests = await database.read(["mutualrequests", {mutual_type: "custom"}, "mutual_id"]);
        expect(Object.keys(requests)).toEqual(["keep"]);
        const watching = await database.read(["mutual", {mutual_type: "watching"}, "mutual_id"]);
        expect(Object.keys(watching)).toEqual(["keep"]);
        expect(await database.read(["mutualstamps", {mutual_type: "watching"}, {user_id: "gone"}, "mutual_id"])).toBeUndefined();
        expect(await database.read(["mutualstamps", {mutual_type: "watching"}, {user_id: "reader"}, "mutual_id"])).toEqual({keep: "other"});
    } finally {
        vi.unstubAllGlobals();
    }
});

it("starts cursor cleanup in parallel and records activity only after every cursor resolves", async () => {
    const {backend, listener} = setup({});
    const invoke = backend.request.getMockImplementation();
    const started = [];
    const finish = [];
    backend.request.mockImplementation((name, path, ...args) => {
        if (name !== "database.cursor") return invoke(name, path, ...args);
        return Promise.resolve({next: vi.fn(size => {
            expect(size).toBe(1000);
            started.push(path[0]);
            return new Promise(resolve => finish.push(resolve));
        })});
    });
    const pending = run(listener);
    try {
        await vi.waitFor(() => expect(started).toEqual(["posts", "extra", "mutual", "mutualrequests", "mutualrequests", "mutualstamps", "mutualstamps"]));
        const activities = () => backend.request.mock.calls.filter(([name]) => name === "database.create");
        expect(activities()).toHaveLength(0);
        finish[0]([]);
        await Promise.resolve();
        expect(activities()).toHaveLength(0);
        finish.slice(1).forEach(resolve => resolve([]));
        await pending;
        expect(activities()).toHaveLength(1);
    } finally {
        finish.forEach(resolve => resolve([]));
        await pending;
    }
});

it("cleans personal and authored stamps across types through real LocalBackend value cursors", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storageId = "user-delete-stamp-values";
        const database = createLocalDatabase({storageId});
        await database.read(["mutualstamps"]);
        const local = new LocalBackend({storageId});
        const stamp = (type, uid, id) => ["mutualstamps", {mutual_type: type}, {user_id: uid}, {mutual_id: id}];
        await local.request("database.update", "", new Map([
            [stamp("watching", "gone", "foreign"), "other"],
            [stamp("watching", "gone", "overlap"), "gone"],
            [stamp("watching", "reader", "authored"), "gone"],
            [stamp("watching", "reader", "keep"), "other"],
            [stamp("_", "gone", "foreign"), "other"],
            [stamp("_", "reader", "authored"), "gone"],
            [stamp("_", "reader", "keep"), "reader"],
        ]));
        const backend = {
            TIMESTAMP: local.TIMESTAMP,
            getCurrentUser: async () => "admin",
            request: vi.fn((name, ...args) => name === "database.create"
                ? Promise.resolve() : local.request(name, ...args)),
        };
        await run(new UserListener(backend));
        for (const type of ["watching", "_"]) {
            expect(await database.read(["mutualstamps", {mutual_type: type}, {user_id: "gone"}, "mutual_id"])).toBeUndefined();
            expect(await database.read(stamp(type, "reader", "authored"))).toBeUndefined();
        }
        expect(await database.read(stamp("watching", "reader", "keep"))).toBe("other");
        expect(await database.read(stamp("_", "reader", "keep"))).toBe("reader");
        expect(backend.request.mock.calls.filter(([name, path]) =>
            name === "database.cursor" && path[0] === "mutualstamps")).toHaveLength(2);
        expect(backend.request.mock.calls.some(([name, path]) =>
            name === "database.read" && path[0] === "mutualstamps")).toBe(false);
    } finally {
        vi.unstubAllGlobals();
    }
});
