import {getFunctions} from "firebase/functions";
import FirebaseDatabase from "../../firebase";
import DatabaseBase from "../../common/DatabaseBase";
import LocalDatabase from "../../local";

vi.mock("firebase/functions", () => ({
    getFunctions: vi.fn(() => { throw new Error("unexpected fallback"); }),
    httpsCallable: vi.fn()
}));

beforeEach(() => vi.clearAllMocks());
const path = ["posts", {post_id: "p1"}];
const forProvider = (provider, backend, onError) => provider === "firebase"
    ? new FirebaseDatabase({firebase: {app: {}}, backend, onError})
    : new LocalDatabase({backend, onError});
const address = provider => provider === "firebase" ? "posts/p1" : path;
const snapshot = (value, etag = "initial") => ({value, etag});
const commit = value => ({committed: true, value});

describe.each(["local", "firebase"])("%s update preparation", provider => {
    it("inherits the superclass update without a provider override", async () => {
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot({keep: true})).mockResolvedValueOnce(commit({keep: true, added: 1}))};
        const database = forProvider(provider, backend);
        expect(Object.hasOwn(Object.getPrototypeOf(database), "update")).toBe(false);
        expect(database.update).toBe(DatabaseBase.prototype.update);
        const update = vi.spyOn(DatabaseBase.prototype, "update");
        await database.update(path, {added: 1});
        expect(update).toHaveBeenCalledExactlyOnceWith(path, {added: 1});
        expect(backend.request.mock.calls[1][2]).toEqual({keep: true, added: 1});
    });

    it("merges a record in Database and sends its complete value for conditional replacement", async () => {
        const before = {keep: true, nested: {old: 1}, obsolete: true};
        const after = {keep: true, nested: {next: 2}};
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot(before)).mockResolvedValueOnce(commit(after))};
        expect(await forProvider(provider, backend).update(path, {nested: {next: 2}, obsolete: null})).toBeUndefined();
        expect(backend.request.mock.calls).toEqual([
            ["database.update", address(provider), null, {mode: "read"}],
            ["database.update", address(provider), after, {mode: "replace", etag: "initial"}]
        ]);
        expect(before).toEqual({keep: true, nested: {old: 1}, obsolete: true});
        expect(getFunctions).not.toHaveBeenCalled();
    });

    it("replaces supplied collection children rather than merging their fields", async () => {
        const before = {p1: {a: 1, b: 2}, p2: {keep: true}, p3: false};
        const after = {p1: {a: 3}, p2: {keep: true}, p4: 0};
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot(before)).mockResolvedValueOnce(commit(after))};
        await forProvider(provider, backend).update(["posts"], {p1: {a: 3}, p3: null, p4: 0});
        expect(backend.request.mock.calls[1]).toEqual([
            "database.update", provider === "firebase" ? "posts" : ["posts"], after, {mode: "replace", etag: "initial"}
        ]);
    });

    it("applies relative child paths, deletes nulls and preserves array siblings without mutating the snapshot", async () => {
        const before = {nested: {keep: true, remove: 1}, list: [1, 2, 3]};
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot(before)).mockResolvedValueOnce(commit({}))};
        await forProvider(provider, backend).update(path, {"nested/add": false, "nested/remove": null, "list/1": 4, "missing/child": null});
        expect(backend.request.mock.calls[1][2]).toEqual({nested: {keep: true, add: false}, list: [1, 4, 3]});
        expect(before).toEqual({nested: {keep: true, remove: 1}, list: [1, 2, 3]});
    });

    it("keeps prototype-like names as ordinary data without modifying prototypes", async () => {
        const before = JSON.parse('{"__proto__":{"keep":true},"constructor":{"value":1}}');
        const changes = JSON.parse('{"__proto__/next":2,"constructor/value":3}');
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot(before)).mockResolvedValueOnce(commit({}))};
        await forProvider(provider, backend).update(path, changes);
        const value = backend.request.mock.calls[1][2];
        expect(Object.hasOwn(value, "__proto__")).toBe(true);
        expect(value.__proto__).toEqual({keep: true, next: 2});
        expect(value.constructor).toEqual({value: 3});
        expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
        expect({}).not.toHaveProperty("next");
    });

    it("rebuilds the complete object from a fresh snapshot after a conflict", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot({keep: 1}))
            .mockResolvedValueOnce({committed: false, ...snapshot({keep: 2, concurrent: true}, "fresh")})
            .mockResolvedValueOnce(commit({}))};
        await forProvider(provider, backend).update(path, {added: true});
        expect(backend.request.mock.calls[1][2]).toEqual({keep: 1, added: true});
        expect(backend.request.mock.calls[2]).toEqual([
            "database.update", address(provider), {keep: 2, concurrent: true, added: true}, {mode: "replace", etag: "fresh"}
        ]);
    });

    it("executes and retries callbacks in Database, sending only their full result", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot({count: 1, old: true}))
            .mockResolvedValueOnce({committed: false, ...snapshot({count: 3}, "fresh")})
            .mockResolvedValueOnce(commit({count: 4}))};
        const callback = vi.fn(value => ({count: value.count + 1}));
        expect(await forProvider(provider, backend).update(path, callback)).toEqual({count: 4});
        expect(callback.mock.calls).toEqual([[{count: 1, old: true}], [{count: 3}]]);
        expect(backend.request.mock.calls[1][2]).toEqual({count: 2});
        expect(backend.request.mock.calls[2][2]).toEqual({count: 4});
    });

    it.each([null, undefined, false, 0, "", [1, 2]])("preserves callback result %j", async value => {
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot({old: true})).mockResolvedValueOnce(commit(value ?? null))};
        expect(await forProvider(provider, backend).update(path, () => value)).toEqual(value ?? null);
        expect(backend.request.mock.calls[1][2]).toEqual(value ?? null);
    });

    it("passes timestamp and increment markers inside the complete value", async () => {
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot({count: 5, keep: true})).mockResolvedValueOnce(commit({}))};
        const database = forProvider(provider, backend), time = database.TIMESTAMP, delta = database.increment(2);
        await database.update(path, {count: delta, time});
        expect(backend.request.mock.calls[1][2]).toEqual({count: delta, time, keep: true});
        expect(backend.request.mock.calls[1][2].count).toBe(delta);
        expect(backend.request.mock.calls[1][2].time).toBe(time);
    });

    it("sends a Map of full batch replacements in one provider-normalized request", async () => {
        const backend = {request: vi.fn().mockResolvedValue(null)};
        const updates = new Map([[path, {complete: true}], [["roles", {user_id: "u"}], null]]);
        expect(await forProvider(provider, backend).update(updates)).toBeUndefined();
        expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", "",
            provider === "firebase" ? {"posts/p1": {complete: true}, "roles/u": null} : updates);
    });

    it("reports errors once through the effective onError", async () => {
        const failure = new Error("backend failed"), onError = vi.fn(), defaultError = vi.fn();
        const backend = {request: vi.fn().mockRejectedValue(failure)};
        expect(await forProvider(provider, backend, defaultError).update(path, {count: 1}, {onError})).toBeUndefined();
        expect(onError).toHaveBeenCalledExactlyOnceWith(failure, "update", {path, changes: {count: 1}});
        expect(defaultError).not.toHaveBeenCalled();
    });

    it("rejects invalid changes and overlapping child paths before making requests", async () => {
        const backend = {request: vi.fn()};
        const database = forProvider(provider, backend);
        for (const changes of [undefined, null, false, 1, [], {a: 1, "a/b": 2}, {"a/": 1}, {"": 1}]) {
            await expect(database.update(path, changes)).rejects.toMatchObject({code: "database/invalid-argument"});
        }
        const callback = vi.fn();
        await expect(database.update(new Map([[path, callback]]))).rejects.toMatchObject({code: "database/invalid-argument"});
        expect(callback).not.toHaveBeenCalled();
        expect(backend.request).not.toHaveBeenCalled();
    });

    it("rejects asynchronous or throwing callbacks without requesting replacement", async () => {
        const backend = {request: vi.fn().mockResolvedValue(snapshot(1))};
        const database = forProvider(provider, backend);
        await expect(database.update(path, async () => 2)).rejects.toMatchObject({code: "database/invalid-argument"});
        const failure = new Error("callback failed");
        await expect(database.update(path, () => { throw failure; })).rejects.toBe(failure);
        expect(backend.request.mock.calls.every(call => call[3].mode === "read")).toBe(true);
    });

    it("stops after 25 conditional replacements and reports a conflict", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const backend = {request: vi.fn().mockResolvedValueOnce(snapshot(0))
            .mockResolvedValue({committed: false, ...snapshot(1, "conflict")})};
        const onError = vi.fn();
        await forProvider(provider, backend).update(path, value => value + 1, {onError});
        expect(backend.request).toHaveBeenCalledTimes(26);
        expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "database/conflict"}), "update", {path, changes: expect.any(Function)});
    });

    it("requires the passed backend and does not access IndexedDB or create FirebaseBackendClient", async () => {
        const open = vi.fn(() => { throw new Error("unexpected IndexedDB"); });
        vi.stubGlobal("indexedDB", {open});
        try {
            await expect(forProvider(provider).update(path, {})).rejects.toBeInstanceOf(TypeError);
            const updates = new Map([[path, {}]]);
            await expect(forProvider(provider).update(updates)).rejects.toBeInstanceOf(TypeError);
            expect(open).not.toHaveBeenCalled();
            expect(getFunctions).not.toHaveBeenCalled();
        } finally { vi.unstubAllGlobals(); }
    });
});

it("implements update in DatabaseBase with validated paths and a Map batch by default", async () => {
    const backend = {request: vi.fn().mockResolvedValueOnce(snapshot({keep: true})).mockResolvedValueOnce(commit({keep: true, added: 1}))};
    const database = new DatabaseBase({backend});
    await database.update(path, {added: 1});
    expect(backend.request.mock.calls[1]).toEqual([
        "database.update", path, {keep: true, added: 1}, {mode: "replace", etag: "initial"}
    ]);
    backend.request.mockClear();
    backend.request.mockResolvedValue(null);
    const updates = new Map([[path, {complete: true}]]);
    await database.update(updates);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", "", updates);
});
