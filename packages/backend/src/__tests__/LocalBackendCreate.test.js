import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local";
import LocalDatabase from "../../../database/src/local";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("creates directly through backend without calling database.create and shares markers", async () => {
    const database = new LocalDatabase({storageId: "backend-create-direct"});
    const backend = new LocalBackend({storageId: database.storageId});
    const create = vi.spyOn(database, "create").mockImplementation(() => { throw new Error("recursive create"); });
    const key = await backend.request("database.create", ["posts", "post_id"], id => ({
        id, count: database.increment(2), time: database.TIMESTAMP
    }));
    expect(key).toBe("1");
    expect(await database.read(["posts", {post_id: key}])).toEqual({id: key, count: 2, time: expect.any(Number)});
    expect(create).not.toHaveBeenCalled();
    await expect(backend.request("database.create", ["posts", {post_id: key}], {}))
        .rejects.toMatchObject({name: "ConstraintError"});
});

it("preserves the supplied database's custom stores and instance scope", async () => {
    const stores = [{store: "audit", storeConfig: {keyPath: "_id", autoIncrement: true}, storeSchema: []}];
    const database = new LocalDatabase({storageId: "backend-create-stores", stores});
    const backend = new LocalBackend({storageId: database.storageId, stores});
    await backend.request("database.create", ["audit", {id: "a"}], {value: 1});
    expect(await database.read(["audit", {id: "a"}])).toEqual({value: 1});
    const plain = new LocalDatabase({storageId: database.storageId});
    await expect(new LocalBackend({storageId: plain.storageId}).request("database.create", ["audit", {id: "b"}], {}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});

it("rolls back generated IDs and publishes only committed creations", async () => {
    const database = new LocalDatabase({storageId: "backend-create-notifications"});
    const backend = new LocalBackend({storageId: database.storageId});
    const events = [];
    const listener = database.addEventListener(["posts"], {onChange: value => events.push(value)});
    try {
        // Queue a failed transaction behind the initial listener snapshot.
        const failure = new Error("callback failed");
        await expect(backend.request("database.create", ["posts", "post_id"], () => { throw failure; }))
            .rejects.toBe(failure);
        const initial = events.length;
        expect(await backend.request("database.create", ["posts", "post_id"], id => ({id}))).toBe("1");
        expect(events).toHaveLength(initial + 1);
        expect(events.at(-1)).toEqual({"1": {id: "1"}});
        await expect(backend.request("database.create", ["posts", "post_id"], async () => ({})))
            .rejects.toMatchObject({code: "database/invalid-argument"});
        expect(events).toHaveLength(initial + 1);
        expect(await backend.request("database.create", ["posts", "post_id"], {})).toBe("2");
    } finally {
        listener.remove();
    }
});

it("keeps the adapter error boundary and reports callback failures once", async () => {
    const onError = vi.fn();
    const database = new LocalDatabase({storageId: "backend-create-errors", onError});
    const failure = new Error("failed");
    const path = ["posts", "post_id"];
    const callback = () => { throw failure; };
    expect(await database.create(path, callback)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure, "create", {path, value: callback});
    expect(await database.create(path, {})).toBe("1");
});

it("initializes standalone backend storage and validates request arity", async () => {
    const backend = new LocalBackend();
    expect(await backend.request("database.create", ["posts", {post_id: "p1"}], {value: 1})).toBe("p1");
    expect(await new LocalDatabase().read(["posts", {post_id: "p1"}])).toEqual({value: 1});
    await expect(backend.request("database.create", ["posts", "post_id"]))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});

it("delegates creation to the supplied backend and preserves its result and error boundary", async () => {
    const backend = {request: vi.fn().mockResolvedValue("permanent-key")};
    const onError = vi.fn();
    const database = new LocalDatabase({storageId: "backend-injected", backend, onError});
    const path = ["posts", "post_id"];
    const value = {title: "A"};
    expect(await database.create(path, value)).toBe("permanent-key");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", path, value);
    const error = new Error("backend failed");
    backend.request.mockRejectedValueOnce(error);
    expect(await database.create(path, value)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "create", {path, value});
});

it("routes default adapter creation through LocalBackend.request", async () => {
    const request = vi.spyOn(LocalBackend.prototype, "request");
    const database = new LocalDatabase({storageId: "backend-default-route"});
    const path = ["posts", {post_id: "p1"}];
    expect(await database.create(path, {value: 1})).toBe("p1");
    expect(request).toHaveBeenCalledExactlyOnceWith("database.create", path, {value: 1});
    expect(await database.read(path)).toEqual({value: 1});
});

it("configures standalone storage lazily and validates storage IDs", async () => {
    const open = vi.spyOn(indexedDB, "open");
    const backend = new LocalBackend({storageId: "standalone-lazy"});
    expect(open).not.toHaveBeenCalled();
    expect(await backend.request("database.create", ["posts", "post_id"], {})).toBe("1");
    expect(open).toHaveBeenCalled();
    for (const storageId of ["", "  ", null, 1]) {
        expect(() => new LocalBackend({storageId})).toThrow("storageId must be a non-empty string.");
    }
});

it("resolves one default LocalBackend and preserves explicitly supplied backends", async () => {
    const {default: resolveBackend} = await import("../resolveBackend");
    const backend = await resolveBackend();
    expect(backend).toBeInstanceOf(LocalBackend);
    expect(await resolveBackend()).toBe(backend);
    const explicit = new LocalBackend({storageId: "explicit-backend"});
    expect(await resolveBackend(explicit)).toBe(explicit);
});
