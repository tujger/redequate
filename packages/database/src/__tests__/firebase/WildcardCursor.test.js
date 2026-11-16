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
        cursor = new FirebaseCursorServer(database, pattern, {orderBy: "uid", equalTo: "u"});
    }
    expect(await cursor.next(1)).toEqual([{key: "r1", params: {mutual_type: "a"}, value: {uid: "u", id: "a"}}]);
    expect(await cursor.next(1)).toEqual([{key: "r1", params: {mutual_type: "b"}, value: {uid: "u", id: "b"}}]);
    expect(await cursor.next(1)).toEqual([]);
});

for (const path of ["records", pattern]) it(`keeps native Firebase cursor types for ${JSON.stringify(path)}`, () => {
    const fixture = createFirebase();
    const client = new FirebaseCursorClient(fixture.firebase, path);
    const server = new FirebaseCursorServer({ref: vi.fn()}, path);
    expect(client.constructor).toBe(FirebaseCursorClient);
    expect(server.constructor).toBe(FirebaseCursorServer);
    expect(client).toBeInstanceOf(FirebaseCursorBase);
    expect(server).toBeInstanceOf(FirebaseCursorBase);
    expect(client).not.toBeInstanceOf(FirebaseCursorServer);
    expect(server).not.toBeInstanceOf(FirebaseCursorClient);
    expect(fixture.sdk.refs).toHaveLength(0);
});
