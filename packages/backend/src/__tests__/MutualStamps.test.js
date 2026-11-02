import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import {mutualstamps} from "../common";

const args = {mutualType: "example", userId: "reader", mutualId: "item", value: "author"};
const stamp = ["mutualstamps", {mutual_type: "example"}, {user_id: "reader"}, {mutual_id: "item"}];
const counter = ["_counters", {id: "reader"}, "mutualstamps", {mutual_type: "example"}];
let sequence = 0;
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

async function setup(provider) {
    if (provider === "local") {
        const storageId = `mutual-stamps-${++sequence}`;
        const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId, backend});
        await database.read(["mutualstamps"]);
        return {backend, read: path => backend.request("database.read", path)};
    }
    const values = new Map();
    const backend = new FirebaseServerBackend(() => ({ref: address => ({
        get: async () => { const value = values.get(address) ?? null; return {val: () => value}; },
        on: (event, callback) => callback(), off: () => {},
        transaction: async callback => {
            const value = callback(values.get(address) ?? null);
            if (value === undefined) return {committed: false, snapshot: {val: () => values.get(address) ?? null}};
            values.set(address, value);
            return {committed: true, snapshot: {val: () => value}};
        }
    })}));
    const address = path => path.map(segment => typeof segment === "string" ? segment : Object.values(segment)[0]).join("/");
    return {backend, read: async path => values.get(address(path)) ?? null};
}

for (const provider of ["local", "admin"]) describe(provider, () => {
    it("creates one stamp, increments its counter and leaves both unchanged on repetition", async () => {
        const {backend, read} = await setup(provider);
        expect(await mutualstamps.createStamp({backend, ...args})).toBe(true);
        expect(await read(stamp)).toBe("author");
        expect(await read(counter)).toBe(1);
        expect(await mutualstamps.createStamp({backend, ...args, value: "replacement"})).toBe(false);
        expect(await read(stamp)).toBe("author");
        expect(await read(counter)).toBe(1);
    });

    it("counts only the winner of competing conditional writes", async () => {
        const {backend, read} = await setup(provider);
        vi.spyOn(Math, "random").mockReturnValue(0);
        const results = await Promise.all(Array.from({length: 8}, () => mutualstamps.createStamp({backend, ...args})));
        expect(results.filter(Boolean)).toHaveLength(1);
        expect(await read(counter)).toBe(1);
    });

    it.each([false, 0, ""])("preserves an existing falsy stamp %j", async value => {
        const {backend, read} = await setup(provider);
        expect(await mutualstamps.createStamp({backend, ...args, value})).toBe(true);
        expect(await mutualstamps.createStamp({backend, ...args})).toBe(false);
        expect(await read(stamp)).toBe(value);
        expect(await read(counter)).toBe(1);
    });
});

it.each([null, undefined])("rejects a missing stamp value %j before writing", async value => {
    const backend = {request: vi.fn()};
    await expect(mutualstamps.createStamp({backend, ...args, value})).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(backend.request).not.toHaveBeenCalled();
});

it("propagates stamp write errors without requesting a counter update", async () => {
    const error = new Error("write failed");
    const backend = {request: vi.fn().mockResolvedValueOnce({value: null, etag: "empty"}).mockRejectedValueOnce(error)};
    await expect(mutualstamps.createStamp({backend, ...args})).rejects.toBe(error);
    expect(backend.request).toHaveBeenCalledTimes(2);
});

it("propagates counter errors after a successful stamp write", async () => {
    const error = new Error("counter failed");
    const backend = {request: vi.fn().mockResolvedValueOnce({value: null, etag: "empty"})
        .mockResolvedValueOnce({committed: true, value: args.value}).mockRejectedValueOnce(error)};
    await expect(mutualstamps.createStamp({backend, ...args})).rejects.toBe(error);
    expect(backend.request.mock.calls[2][1]).toEqual(counter);
});
