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

it("allows frontend all() reads and rejects handler writes", async () => {
    const fixture = createFirebase();
    const rows = {mutual: {a: {r1: {uid: "u"}}, b: {r1: {uid: "u"}}}};
    fixture.sdk.once.mockImplementation(async ref => fixture.snapshot(ref.path.split("/").filter(Boolean)
        .reduce((node, key) => node?.[key], rows)));
    const reading = new FirebaseCursorClient(pattern, {
        id: "firebase-wildcard-read", handle: () => undefined
    }, {database: new FirebaseDatabase({firebase: fixture.firebase}), firebase: fixture.firebase});
    expect(await reading.all(10)).toBe(2);
    for (const replacement of [null, {uid: "u", edited: true}]) {
        const cursor = new FirebaseCursorClient(pattern, {
            id: "firebase-wildcard-all", handle: () => replacement
        }, {database: new FirebaseDatabase({firebase: fixture.firebase}), firebase: fixture.firebase});
        await expect(cursor.all(10)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(rows.mutual.a.r1).toEqual({uid: "u"});
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
    const backend = {getDatabaseInstance: () => database, request: vi.fn(async (name, path, changes) => {
        if (name === "database.read") return status;
        status = [...changes].find(([recordPath]) => Array.isArray(recordPath) && recordPath[0] === "meta")?.[1];
    })};
    const cursor = new FirebaseCursorServer(pattern, {
        id: "firebase-server-wildcard-all", handle: () => ({uid: "edited"})
    }, {backend});
    expect(await cursor.all(2)).toBe(2);
    const batches = backend.request.mock.calls.filter(([name]) => name === "database.update");
    expect(batches).toHaveLength(2);
    expect([...batches[0][2].keys()]).toEqual([
        ["mutual", {mutual_type: "a"}, {mutual_id: "r1"}],
        ["mutual", {mutual_type: "b"}, {mutual_id: "r1"}],
        ["meta", {setting: "cursor:firebase-server-wildcard-all"}]
    ]);
    expect([...batches[1][2].keys()]).toEqual([["meta", {setting: "cursor:firebase-server-wildcard-all"}]]);
});
