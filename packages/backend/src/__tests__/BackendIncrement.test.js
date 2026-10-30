import {IDBFactory} from "fake-indexeddb";
import {increment as firebaseIncrement} from "firebase/database";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import BackendBase from "../common/BackendBase";
import LocalBackend from "../local/LocalBackend";
import FirebaseBackendClient from "../firebase-client/FirebaseBackendClient";
import LocalDatabase from "../../../database/src/local";
import {isIncrement} from "../local/increment";

vi.mock("firebase/database", async importOriginal => {
    const actual = await importOriginal();
    return {...actual, increment: vi.fn(actual.increment)};
});

const transport = vi.hoisted(() => ({value: null, version: 0, calls: []}));
vi.mock("firebase/functions", () => ({
    getFunctions: () => ({}),
    httpsCallable: (_, endpoint) => async payload => {
        expect(endpoint).toBe("database-update");
        const [path, value, options] = payload;
        expect(value).not.toBeTypeOf("function");
        transport.calls.push(structuredClone(payload));
        const snapshot = () => ({value: transport.value, etag: String(transport.version)});
        if (!options) {
            // A callable PATCH must carry the marker under a field, not at its root.
            expect(path).toBe("");
            expect(Object.keys(value)).toEqual(["meta/count"]);
            const delta = value["meta/count"][".sv"].increment;
            transport.value = (typeof transport.value === "number" ? transport.value : 0) + delta;
            transport.version++;
            return {data: null};
        }
        if (options.mode === "read") return {data: snapshot()};
        if (options.etag !== String(transport.version)) return {data: {committed: false, ...snapshot()}};
        transport.value = value; transport.version++;
        return {data: {committed: true, value}};
    },
}));

let nextId = 0;
beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.mocked(firebaseIncrement).mockClear();
    transport.value = null; transport.version = 0; transport.calls.length = 0;
    vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => vi.unstubAllGlobals());
const path = ["meta", {count: "count"}];
const setup = async provider => {
    if (provider === "firebase") return new FirebaseBackendClient({firebase: {app: {}}});
    const storageId = `increment-${++nextId}`;
    const backend = new LocalBackend({storageId});
    await new LocalDatabase({storageId, backend}).read(["meta"]);
    return backend;
};
const seed = async (backend, value) => {
    const snapshot = await backend.request("database.update", path, null, {mode: "read"});
    await backend.request("database.update", path, value, {mode: "replace", etag: snapshot.etag});
};

it("returns a local object with a private Symbol delta without a database method", () => {
    const backend = new LocalBackend({storageId: "increment-shape"});
    expect(() => new BackendBase().increment(2)).toThrow("Not implemented: increment");
    const marker = backend.increment(2);
    expect(typeof marker).toBe("object");
    expect(Object.keys(marker)).toEqual([]);
    const [key] = Object.getOwnPropertySymbols(marker);
    expect(Object.getOwnPropertySymbols(marker)).toHaveLength(1);
    expect(key.description).toBe("LocalBackend.increment");
    expect(marker[key]).toBe(2);
    expect(isIncrement(marker)).toBe(true);
    expect(backend.increment(2)).not.toBe(marker);
    expect(isIncrement({".sv": {increment: 2}})).toBe(false);
    expect(isIncrement(Symbol("LocalBackend.increment"))).toBe(false);
    expect(isIncrement({[Symbol("LocalBackend.increment")]: 2})).toBe(false);
    expect(isIncrement(Object.create(marker))).toBe(false);
    expect(isIncrement({[key]: NaN})).toBe(false);
    expect(isIncrement({[key]: "2"})).toBe(false);
    expect(isIncrement({operation: marker, value: 2})).toBe(false);
    expect(isIncrement(structuredClone(marker))).toBe(false);
    expect(firebaseIncrement).not.toHaveBeenCalled();
    expect(LocalDatabase.prototype).not.toHaveProperty("increment");
});

for (const provider of ["local", "firebase"]) describe(provider, () => {
    it.each([[3, 2, 5], [3, -2, 1], [3, 0, 3], [null, 2, 2], ["old", -2, -2], [false, 1, 1]])(
        "increments %j by %j and returns %j", async (initial, n, expected) => {
            const backend = await setup(provider);
            if (initial !== null) await seed(backend, initial);
            expect(await backend.request("database.update", path, backend.increment(n))).toBe(provider === "local" ? expected : null);
            expect((await backend.request("database.update", path, null, {mode: "read"})).value).toBe(expected);
        }
    );

    if (provider === "local") {
        it.each([NaN, Infinity, -Infinity, "1", undefined, null, {}])("rejects an invalid step %j", async n => {
            const backend = await setup(provider);
            expect(() => backend.increment(n)).toThrow("increment requires a finite number.");
        });

        it("rejects a bigint step", async () => {
            const backend = await setup(provider);
            expect(() => backend.increment(1n)).toThrow("increment requires a finite number.");
        });
    }

    it("sends one atomic increment request without a callback or preliminary read", async () => {
        const backend = await setup(provider);
        await seed(backend, 1);
        transport.calls.length = 0;
        const request = vi.spyOn(backend, "request");
        const marker = provider === "local" ? backend.increment(2) : structuredClone(backend.increment(2));
        expect(await backend.request("database.update", path, marker)).toBe(provider === "local" ? 3 : null);
        expect(request).toHaveBeenCalledExactlyOnceWith("database.update", path, marker);
        if (provider === "firebase") expect(transport.calls).toEqual([["", {"meta/count": marker}]]);
    });

    it("preserves increments under concurrent updates", async () => {
        const backend = await setup(provider);
        await Promise.all(Array.from({length: 10}, () => backend.request("database.update", path, backend.increment(1))));
        expect((await backend.request("database.update", path, null, {mode: "read"})).value).toBe(10);
    });

    it("does not accept executable callbacks through request", async () => {
        const backend = await setup(provider);
        await expect(backend.request("database.update", path, () => 5)).rejects.toThrow();
    });
});

it("updates post counters through a real local reaction chain", async () => {
    const storageId = `post-counter-${++nextId}`;
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    const post = ["posts", {post_id: "p1"}];
    const total = ["_counters", {id: "total"}], user = ["_counters", {id: "u1"}];
    await database.read(["posts"]);
    await database.create(post, {uid: "u1", text: "A"});
    await vi.waitFor(async () => {
        expect(await database.read(user)).toEqual({posts: 1});
        expect(await database.read(total)).toEqual({posts: 1});
    });
    await database.update(post, {text: "B"});
    expect(await database.read(total)).toEqual({posts: 1});
    await database.delete(post);
    await vi.waitFor(async () => {
        expect(await database.read(user)).toEqual({});
        expect(await database.read(total)).toEqual({});
    });
});


it("rejects local increment overflow and rolls back the stored value", async () => {
    const backend = await setup("local");
    await seed(backend, Number.MAX_VALUE);
    await expect(backend.request("database.update", path, backend.increment(Number.MAX_VALUE))).rejects.toThrow();
    expect((await backend.request("database.update", path, null, {mode: "read"})).value).toBe(Number.MAX_VALUE);
});


it("delegates Firebase marker construction to the SDK and returns its object", async () => {
    const backend = await setup("firebase");
    const marker = backend.increment(-2);
    expect(firebaseIncrement).toHaveBeenCalledExactlyOnceWith(-2);
    expect(marker).toBe(firebaseIncrement.mock.results[0].value);
});


it("shares BackendBase across local, Firebase client and Firebase server backends", async () => {
    expect(await setup("local")).toBeInstanceOf(BackendBase);
    expect(await setup("firebase")).toBeInstanceOf(BackendBase);
    expect(new FirebaseServerBackend()).toBeInstanceOf(BackendBase);
    expect((await import("../common")).BackendBase).toBe(BackendBase);
    expect((await import("../index")).BackendBase).toBe(BackendBase);
});
