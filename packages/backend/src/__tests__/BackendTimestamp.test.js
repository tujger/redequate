import {serverTimestamp} from "firebase/database";
import {ServerValue} from "../firebase-server/node_modules/firebase-admin/lib/esm/database/index.js";
import BackendBase from "../common/BackendBase";
import {isTimestamp} from "../local/timestamp";
import LocalBackend from "../local/LocalBackend";
import FirebaseBackendClient from "../firebase-client/FirebaseBackendClient";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import DatabaseBase from "../../../database/src/common/DatabaseBase";
import LocalDatabase from "../../../database/src/local";
import FirebaseDatabase from "../../../database/src/firebase";

vi.mock("firebase/functions", () => ({getFunctions: () => ({}), httpsCallable: vi.fn()}));
vi.mock("firebase/database", async importOriginal => {
    const actual = await importOriginal();
    return {...actual, serverTimestamp: vi.fn(actual.serverTimestamp)};
});
beforeEach(() => vi.mocked(serverTimestamp).mockClear());

it("declares the timestamp contract without supplying a default marker", () => {
    expect(() => new BackendBase().TIMESTAMP).toThrow("Not implemented: timestamp");
});

it("LocalBackend owns a stable, frozen timestamp marker with a private Symbol", () => {
    const backend = new LocalBackend({storageId: "timestamp-local"});
    expect(Object.keys(backend.TIMESTAMP)).toEqual([]);
    expect(Object.getOwnPropertySymbols(backend.TIMESTAMP)).toHaveLength(1);
    expect(Object.isFrozen(backend.TIMESTAMP)).toBe(true);
    expect(isTimestamp(backend.TIMESTAMP)).toBe(true);
    expect(backend.TIMESTAMP).toBe(backend.TIMESTAMP);
    expect(isTimestamp(JSON.parse(JSON.stringify(backend.TIMESTAMP)))).toBe(false);
    expect(isTimestamp(structuredClone(backend.TIMESTAMP))).toBe(false);
    expect(isTimestamp({".sv": "timestamp"})).toBe(false);
    expect(isTimestamp({[Symbol("LocalBackend.TIMESTAMP")]: true})).toBe(false);
    expect(isTimestamp(Object.create(backend.TIMESTAMP))).toBe(false);
    expect(serverTimestamp).not.toHaveBeenCalled();
});

it("FirebaseBackendClient delegates marker creation to its SDK", () => {
    const backend = new FirebaseBackendClient({firebase: {app: {}}});
    const marker = backend.TIMESTAMP;
    expect(serverTimestamp).toHaveBeenCalledTimes(1);
    expect(marker).toBe(serverTimestamp.mock.results[0].value);
});

it("FirebaseServerBackend exposes the Admin SDK timestamp without opening the database", () => {
    const getDatabase = vi.fn();
    const backend = new FirebaseServerBackend(getDatabase);
    expect(backend.TIMESTAMP).toBe(ServerValue.TIMESTAMP);
    expect(getDatabase).not.toHaveBeenCalled();
});

it.each([DatabaseBase, LocalDatabase, FirebaseDatabase])("Database delegates timestamp access to its injected backend", Database => {
    const marker = {};
    const timestamp = vi.fn(() => marker);
    const backend = {get TIMESTAMP() { return timestamp(); }};
    const database = new Database({backend, firebase: {app: {}}});
    expect(database.TIMESTAMP).toBe(marker);
    expect(timestamp).toHaveBeenCalledTimes(1);
});

it("keeps provider Database classes free of timestamp implementations", () => {
    expect(Object.hasOwn(LocalDatabase.prototype, "TIMESTAMP")).toBe(false);
    expect(Object.hasOwn(FirebaseDatabase.prototype, "TIMESTAMP")).toBe(false);
});
