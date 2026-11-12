import createService from "../../../../../src/__tests__/createService";
import {vi} from "vitest";
import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

const setup = () => {
    const fixture = createFirebase();
    const backend = {request: vi.fn().mockResolvedValue(null)};
    const database = createService(FirebaseDatabase, {firebase: fixture.firebase, backend});
    return {fixture, backend, database};
};
const saved = call => Object.entries(call[2]).find(([path]) => path.startsWith("meta/_checkpoints/"))?.[1];

it("persists the first key before fetching the rest or handling, then commits page data separately", async () => {
    const {fixture, backend, database} = setup();
    const events = [];
    fixture.sdk.once.mockImplementation(async ref => {
        events.push(`read:${fixture.sdk.once.mock.calls.length}`);
        return fixture.snapshot(fixture.sdk.once.mock.calls.length === 1 ? {a: 1} : {b: 2});
    });
    backend.request.mockImplementation(async (method, path, changes) => {
        events.push(saved([method, path, changes]) ? "checkpoint" : "data");
    });
    const cursor = database.cursor("records", {handle: ({key}) => { events.push(`handle:${key}`); return 9; }});
    expect(await cursor.all(2)).toBe(2);
    expect(events.slice(0, 5)).toEqual(["read:1", "checkpoint", "read:2", "handle:a", "handle:b"]);
    expect(events).toContain("data");
    expect(backend.request.mock.calls[0][2]).not.toBeInstanceOf(Map);
    expect(saved(backend.request.mock.calls[0])).toMatchObject({key: "a", count: 0, finished: false});
    expect(Object.keys(backend.request.mock.calls.find(call => !saved(call))[2])).toEqual(["records/a", "records/b"]);
    expect(backend.request.mock.calls.every(call => !(saved(call) && Object.keys(call[2]).length > 1))).toBe(true);
});

it("records the original handler error on a durable page start and resumes inclusively", async () => {
    const {fixture, backend, database} = setup();
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1}))
        .mockResolvedValueOnce(fixture.snapshot({b: 2}));
    const error = new Error("stop");
    await expect(database.cursor("records", {handle: ({key}) => { if (key === "b") throw error; }}).all(2)).rejects.toBe(error);
    const failed = saved(backend.request.mock.calls.at(-1));
    expect(failed).toMatchObject({key: "a", count: 0, finished: false, error: {message: "stop"}});
    expect(backend.request.mock.calls.every(call => !!saved(call))).toBe(true);
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot(failed, "checkpoint", "meta/_checkpoints"))
        .mockResolvedValueOnce(fixture.snapshot({a: 1}))
        .mockResolvedValueOnce(fixture.snapshot({b: 2}));
    const cursor = database.cursor("records");
    expect(await cursor.status()).toEqual({checkpoint: failed});
    expect(await cursor.all(2, failed)).toBe(2);
    expect(fixture.sdk.once.mock.calls[3][0].query).toMatchObject({startAt: ["a"]});
    expect(saved(backend.request.mock.calls.at(-1))).toMatchObject({count: 2, finished: true});
});

it("rejects a failed page-start persistence before another read or handle", async () => {
    const {fixture, backend, database} = setup();
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1}));
    const error = new Error("checkpoint failed");
    backend.request.mockRejectedValueOnce(error);
    const handle = vi.fn();
    await expect(database.cursor("records", {handle}).all(2)).rejects.toBe(error);
    expect(fixture.sdk.once).toHaveBeenCalledTimes(1);
    expect(handle).not.toHaveBeenCalled();
    expect(backend.request).toHaveBeenCalledTimes(1);
});

it("records failed data commit separately without advancing count", async () => {
    const {fixture, backend, database} = setup();
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1}));
    const error = new Error("data failed");
    backend.request.mockResolvedValueOnce(null).mockRejectedValueOnce(error).mockResolvedValue(null);
    await expect(database.cursor("records", {handle: () => 9}).all(2)).rejects.toBe(error);
    expect(saved(backend.request.mock.calls[0])).toMatchObject({key: "a", count: 0});
    expect(saved(backend.request.mock.calls[1])).toBeUndefined();
    expect(saved(backend.request.mock.calls[2])).toMatchObject({key: "a", count: 0, error: {message: "data failed"}});
});

it("preserves the handler error when writing its error checkpoint also fails", async () => {
    const {fixture, backend, database} = setup();
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1}));
    const original = new Error("handler failed");
    const persistence = new Error("checkpoint failed");
    backend.request.mockResolvedValueOnce(null).mockRejectedValueOnce(persistence);
    await expect(database.cursor("records", {handle: () => { throw original; }}).all(2)).rejects.toBe(original);
    expect(original.checkpointError).toBe(persistence);
    expect(backend.request).toHaveBeenCalledTimes(2);
});

it("scans and resumes through the public single-source cursor", async () => {
    const {fixture, backend, database} = setup();
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1}))
        .mockResolvedValueOnce(fixture.snapshot(null));
    const handle = vi.fn();
    const cursor = database.cursor("records", {handle});
    expect(await cursor.all(2)).toBe(1);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({key: "a", value: 1}));
    const checkpoint = saved(backend.request.mock.calls.at(-1));
    expect(checkpoint).toMatchObject({key: "a", count: 1, finished: true});
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot(checkpoint, "checkpoint", "meta/_checkpoints"));
    expect(await database.cursor("records").status()).toEqual({checkpoint});
    expect(await database.cursor("records").all(2, checkpoint)).toBe(0);
    await expect(database.cursor("records").all(0)).rejects.toMatchObject({code: "database/invalid-argument"});
});

it("rejects multiple sources and invalid batch size", async () => {
    const {database} = setup();
    await expect(database.cursor([{path: "records"}, {path: "other"}]).all(2))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.cursor([{path: "records"}, {path: "other"}]).status())
        .rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.cursor("records").all(0)).rejects.toMatchObject({code: "database/invalid-argument"});
});
