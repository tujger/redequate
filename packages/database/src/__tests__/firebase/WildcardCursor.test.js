import FirebaseCursorBase from "../../common/FirebaseCursorBase";
import FirebaseCursorClient from "../../firebase/cursor";
import FirebaseDatabase from "../../firebase";
import FirebaseCursorServer from "../../../../backend/src/firebase-server/src/FirebaseCursorServer";
import {createFirebase} from "../fixtures/firebase";
vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

const pattern = ["mutual", "mutual_type", "mutual_id"];
for (const provider of ["firebase", "admin"]) it(`${provider} discovers branches and returns leaf keys with captured params`, async () => {
    const fixture = createFirebase();
    const rows = {mutual: {a: {r1: {uid: "u", id: "a"}}, b: {r1: {uid: "u", id: "b"}}}};
    const snapshot = address => fixture.snapshot(address.split("/").filter(Boolean).reduce((node, key) => node?.[key], rows));
    let cursor;
    if (provider === "firebase") {
        fixture.sdk.once.mockImplementation(async ref => snapshot(ref.path));
        cursor = new FirebaseDatabase({firebase: fixture.firebase}).cursor(pattern, {orderBy: "uid", equalTo: "u"});
    } else {
        const database = {ref: address => {
            const reference = {get: async () => snapshot(address), once: async () => snapshot(address)};
            for (const method of ["orderByChild", "orderByValue", "orderByKey", "equalTo", "startAt", "endAt", "limitToFirst", "limitToLast"]) reference[method] = () => reference;
            return reference;
        }};
        cursor = new FirebaseCursorServer(pattern, {orderBy: "uid", equalTo: "u"},
            {backend: {getDatabaseInstance: () => database}});
    }
    expect(await cursor.next(1)).toEqual([{key: "r1", params: {mutual_type: "a"}, value: {uid: "u", id: "a"}}]);
    expect(await cursor.next(1)).toEqual([{key: "r1", params: {mutual_type: "b"}, value: {uid: "u", id: "b"}}]);
    expect(await cursor.next(1)).toEqual([]);
});

for (const path of ["records", pattern]) it(`keeps native Firebase cursor types for ${JSON.stringify(path)}`, () => {
    const fixture = createFirebase();
    const client = new FirebaseCursorClient(path, {},
        {database: new FirebaseDatabase({firebase: fixture.firebase}), firebase: fixture.firebase});
    const server = new FirebaseCursorServer(path, {},
        {backend: {getDatabaseInstance: () => ({ref: vi.fn()})}});
    expect(client.constructor).toBe(FirebaseCursorClient);
    expect(server.constructor).toBe(FirebaseCursorServer);
    expect(client).toBeInstanceOf(FirebaseCursorBase);
    expect(server).toBeInstanceOf(FirebaseCursorBase);
    expect(client).not.toBeInstanceOf(FirebaseCursorServer);
    expect(server).not.toBeInstanceOf(FirebaseCursorClient);
    expect(fixture.sdk.refs).toHaveLength(0);
});

it("collects frontend all() updates across pages without writing records", async () => {
    const fixture = createFirebase();
    const backend = {request: vi.fn(), getCurrentUser: vi.fn()};
    const database = new FirebaseDatabase({firebase: fixture.firebase});
    const update = vi.spyOn(database, "update");
    const rows = {mutual: {a: {r1: {uid: "u"}}, b: {r1: {uid: "u"}}, c: {r1: {uid: "u"}}}};
    fixture.sdk.once.mockImplementation(async ref => fixture.snapshot(ref.path.split("/").filter(Boolean)
        .reduce((node, key) => node?.[key], rows)));
    const cursor = new FirebaseCursorClient(pattern, {
        handle: async ({params, value}) => {
            if (params.mutual_type === "a") return {...value, edited: true};
            if (params.mutual_type === "b") return null;
        }
    }, {backend, database, firebase: fixture.firebase});

    expect(await cursor.status()).toMatchObject({checkpoint: null, count: 0, state: "ready", updates: new Map()});
    expect(await cursor.all(1)).toBe(3);
    const status = await cursor.status();
    expect(status).toMatchObject({count: 3, state: "ready", checkpoint: {index: 2, key: "r1", finished: true}});
    expect(status.updates).toEqual(new Map([
        ["mutual/a/r1", {uid: "u", edited: true}],
        ["mutual/b/r1", null]
    ]));
    status.updates.clear();
    expect((await cursor.status()).updates.size).toBe(2);
    expect(rows.mutual).toEqual({a: {r1: {uid: "u"}}, b: {r1: {uid: "u"}}, c: {r1: {uid: "u"}}});
    expect(backend.request).not.toHaveBeenCalled();
    expect(backend.getCurrentUser).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
});

it("reports only completed frontend all() pages after a handler failure", async () => {
    const fixture = createFirebase();
    const rows = {a: 1, b: 2, c: 3, d: 4};
    fixture.sdk.once.mockImplementation(async ref => fixture.snapshot(Object.fromEntries(Object.entries(rows)
        .filter(([key]) => !ref.query.startAt || key >= ref.query.startAt[0])
        .slice(0, ref.query.limitToFirst?.[0] ?? 4))));
    const error = new Error("failed on fourth entry");
    const cursor = new FirebaseCursorClient("records", {
        handle: ({key, value}) => {
            if (key === "d") throw error;
            return value * 10;
        }
    }, {firebase: fixture.firebase});

    await expect(cursor.all(2)).rejects.toBe(error);
    expect(await cursor.status()).toMatchObject({
        count: 2, state: "failed", checkpoint: {index: 1, key: "b", finished: false},
        error: {code: "database/unknown", message: error.message},
        updates: new Map([["records/a", 10], ["records/b", 20]])
    });
});

it.each([{path: ""}, {path: "/"}, {path: []}])("rejects Firebase all() at the root before requesting data ($path)", async ({path}) => {
    const fixture = createFirebase();
    const backend = {request: vi.fn(), getDatabaseInstance: vi.fn()};
    const cursors = [
        new FirebaseCursorClient(path, {}, {backend, firebase: fixture.firebase}),
        new FirebaseCursorServer(path, {}, {backend})
    ];
    for (const cursor of cursors) {
        await expect(cursor.all()).rejects.toMatchObject({
            code: "database/invalid-argument",
            message: "Cursor all() requires a non-empty path."
        });
    }
    expect(fixture.sdk.refs).toHaveLength(0);
    expect(backend.getDatabaseInstance).not.toHaveBeenCalled();
    expect(backend.request).not.toHaveBeenCalled();
});

it("includes the checkpoint branch in normal Firebase root pages", async () => {
    const fixture = createFirebase();
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({_checkpoints: {records: {count: 1}}, records: {a: 1}}));
    const cursor = new FirebaseCursorClient("", {}, {firebase: fixture.firebase});
    expect((await cursor.next(2)).map(({key}) => key)).toEqual(["_checkpoints", "records"]);
});

it("uses the shared all() checkpoint rules without writing frontend status", async () => {
    const fixture = createFirebase();
    const backend = {request: vi.fn(() => { throw new Error("Client all() must not request the backend."); })};
    const rows = {a: {uid: "a"}, b: {uid: "b"}};
    fixture.sdk.once.mockImplementation(async ref => fixture.snapshot(Object.fromEntries(Object.entries(rows)
        .filter(([key]) => !ref.query.startAt || key >= ref.query.startAt[0])
        .slice(0, ref.query.limitToFirst?.[0] ?? 2))));
    const makeCursor = () => new FirebaseCursorClient("records", {}, {backend, firebase: fixture.firebase});
    const checkpoint = {index: 0, key: "a", finished: false};
    expect(await makeCursor().all(10, checkpoint)).toBe(1);
    const current = makeCursor();
    expect((await current.next(1)).map(({key}) => key)).toEqual(["a"]);
    expect(await current.all(10)).toBe(1);
    await expect(makeCursor().all(0)).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(makeCursor().all(1, {index: 0, key: 1, finished: false}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(backend.request).not.toHaveBeenCalled();
});

it("all batches Firebase server wildcard records at their captured paths", async () => {
    const fixture = createFirebase();
    const rows = {mutual: {a: {r1: {uid: "u"}}, b: {r1: {uid: "u"}}}};
    const snapshot = address => fixture.snapshot(address.split("/").filter(Boolean)
        .reduce((node, key) => node?.[key], rows));
    const database = {ref: address => {
        const reference = {once: async () => snapshot(address)};
        for (const method of ["orderByChild", "orderByValue", "orderByKey", "equalTo", "startAt", "endAt", "limitToFirst", "limitToLast"]) {
            reference[method] = () => reference;
        }
        return reference;
    }};
    let status = null;
    const backend = {getDatabaseInstance: () => database, getCurrentUser: async () => "admin", request: vi.fn(async (name, path, changes) => {
        if (name === "database.read") {
            if (!status) return null;
            const {finished, key, index} = status.checkpoint;
            return {...status, checkpoint: {finished, key, index}};
        }
        status = [...changes].find(([recordPath]) => Array.isArray(recordPath) && recordPath[0] === "_checkpoints")?.[1];
    })};
    const cursor = new FirebaseCursorServer(pattern, {
        id: "firebase-server-wildcard-all", handle: () => ({uid: "edited"})
    }, {backend});
    expect(await cursor.all(2)).toBe(2);
    expect(await cursor.status()).toMatchObject({userId: "admin", count: 2, state: "ready"});
    const batches = backend.request.mock.calls.filter(([name]) => name === "database.update");
    expect(batches).toHaveLength(2);
    expect([...batches[0][2].keys()]).toEqual([
        ["mutual", {mutual_type: "a"}, {mutual_id: "r1"}],
        ["mutual", {mutual_type: "b"}, {mutual_id: "r1"}],
        ["_checkpoints", {path: "mutual:mutual_type"}]
    ]);
    expect([...batches[1][2].keys()]).toEqual([["_checkpoints", {path: "mutual:mutual_type"}]]);
});
