import {IDBFactory} from "fake-indexeddb";
import update from "../../../database/src/common/methods/update";
import {updateCounter} from "../common/handlers/utils";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import onEvents from "../local/database/onEvents";
import {observeWrites} from "../local/database/callable/createHelpers";

const relative = [{id: "p1"}, "like"];
const path = ["_counters", ...relative];
let nextId = 0;
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const setup = async (provider, initial = null) => {
    if (provider === "local") {
        const storageId = `counter-update-${++nextId}`;
        const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId, backend});
        await database.read(["_counters"]);
        if (initial !== null) await backend.request("database.update", "", new Map([[path, initial]]));
        return {backend, database, read: () => backend.request("database.read", path)};
    }
    let value = initial;
    const transaction = vi.fn(async callback => {
        const next = callback(value);
        if (next === undefined) return {committed: false, snapshot: {val: () => value}};
        value = next;
        return {committed: true, snapshot: {val: () => value}};
    });
    const ref = vi.fn(() => ({transaction, on: (event, callback) => callback(), off: vi.fn(), get: async () => { const current = value; return {val: () => current}; }}));
    const backend = new FirebaseServerBackend(() => ({ref}));
    return {backend, read: async () => value, transaction, ref};
};

for (const provider of ["local", "admin"]) describe(provider, () => {
    it.each([
        [null, -1, null], [0, -1, null], [-3, -1, null], [1, -1, null], [2, -1, 1], [3, -5, null],
        [null, 1, 1], [0, 2, 2], [-3, 2, 2], [2, 3, 5],
        [null, 0, null], [0, 0, null], [-3, 0, null], [3, 0, 3],
        [0.5, -1, null], [1.5, -0.5, 1],
    ])("updates %j by %j to %j with the original counter semantics", async (initial, increment, expected) => {
        const {backend, read} = await setup(provider, initial);
        expect(await updateCounter(backend, relative, increment)).toBe(expected);
        expect(await read()).toBe(expected);
    });

    it("adds _counters once for a relative array path", async () => {
        const {backend, read, ref} = await setup(provider, 2);
        const request = vi.spyOn(backend, "request");
        expect(await updateCounter(backend, relative, -1)).toBe(1);
        expect(request.mock.calls[0]).toEqual([
            "database.update", path, null, {mode: "read"},
        ]);
        expect(await read()).toBe(1);
        if (ref) expect(ref).toHaveBeenCalledWith("_counters/p1/like");
    });

    it("serializes competing increments and deletions without losing positive counts", async () => {
        const {backend, read} = await setup(provider);
        vi.spyOn(Math, "random").mockReturnValue(0);
        await Promise.all(Array.from({length: 15}, () => updateCounter(backend, relative, 1)));
        expect(await read()).toBe(15);
        await Promise.all(Array.from({length: 20}, () => updateCounter(backend, relative, -1)));
        expect(await read()).toBeNull();
        await Promise.all(Array.from({length: 8}, () => updateCounter(backend, relative, 1)));
        expect(await read()).toBe(8);
    });

    it("does not expose a transaction request", async () => {
        const {backend} = await setup(provider);
        await expect(backend.request("database.transaction", path, () => 1))
            .rejects.toMatchObject({code: "backend/not-implemented"});
    });

});

it.each([NaN, Infinity, -Infinity, "1", undefined])("rejects a non-finite counter step %j before requesting a write", increment => {
    const backend = {request: vi.fn()};
    expect(() => updateCounter(backend, relative, increment)).toThrow();
    expect(backend.request).not.toHaveBeenCalled();
});

it.each([[[]], [""], ["p1/like"], [null], [undefined], [{}]])("rejects a non-array or empty counter path %j before requesting a write", counterPath => {
    const backend = {request: vi.fn()};
    expect(() => updateCounter(backend, counterPath, 1)).toThrow();
    expect(backend.request).not.toHaveBeenCalled();
});

it("recomputes the counter from fresh data after an Admin transaction conflict", async () => {
    const transaction = vi.fn()
        .mockImplementationOnce(async callback => {
            expect(callback(10)).toBe(9);
            expect(callback(1)).toBeUndefined();
            return {committed: false, snapshot: {val: () => 1}};
        })
        .mockImplementationOnce(async callback => {
            expect(callback(1)).toBeNull();
            return {committed: true, snapshot: {val: () => null}};
        });
    const backend = new FirebaseServerBackend(() => ({ref: () => ({
        get: async () => ({val: () => 10}), transaction, on: (event, callback) => callback(), off: vi.fn(),
    })}));
    expect(await updateCounter(backend, relative, -1)).toBeNull();
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), undefined, false);
});

it.each(["get", "transaction"])("Admin SDK %s errors propagate unchanged", async method => {
    const error = new Error("SDK unavailable");
    const ref = {get: async () => ({val: () => 1}), transaction: vi.fn(), on: (event, callback) => callback(), off: vi.fn()};
    ref[method] = vi.fn().mockRejectedValue(error);
    const backend = new FirebaseServerBackend(() => ({ref: () => ref}));
    await expect(updateCounter(backend, relative, -1)).rejects.toBe(error);
});

it("stops after bounded update conflicts without inventing another backend command", async () => {
    vi.useFakeTimers();
    try {
        const backend = {request: vi.fn(async (name, path, value, options) =>
            options.mode === "read" ? {value: 1, etag: "initial"}
                : {committed: false, value: 1, etag: "fresh"})};
        const result = expect(updateCounter(backend, relative, 1)).rejects.toMatchObject({code: "database/conflict"});
        await vi.runAllTimersAsync();
        await result;
        expect(backend.request).toHaveBeenCalledTimes(26);
        expect(backend.request.mock.calls.every(([name, , value]) => name === "database.update" && typeof value !== "function")).toBe(true);
    } finally { vi.useRealTimers(); }
});

it("notifies Local subscribers after commit and allows reactions to await another update", async () => {
    const {backend, read} = await setup("local");
    const handler = vi.fn(async ({value}) => {
        if (value === 1) await updateCounter(backend, relative, 1);
    });
    const remove = onEvents({path: ["_counters", {id: "p1"}, {field: "like"}], onCreate: handler, onUpdate: handler})(backend);
    try {
        await updateCounter(backend, relative, 1);
        await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
        expect(await read()).toBe(2);
    } finally { remove(); }
});

it("does not publish writes after an unchanged or failed Local update", async () => {
    const {backend} = await setup("local", 2);
    const notify = vi.fn(), remove = observeWrites(backend.storageId, notify);
    try {
        await update(backend, path, () => undefined);
        await expect(update(backend, path, () => { throw new Error("failed"); })).rejects.toThrow("failed");
        expect(notify).not.toHaveBeenCalled();
    } finally { remove(); }
});
