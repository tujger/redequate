import {IDBFactory} from "fake-indexeddb";
import ActivityListener, {createActivity} from "../common/handlers/activity";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";

const params = {activity_id: "a1"};
const fakeBackend = (initial = null) => {
    let records = initial, revision = 0;
    return {
        TIMESTAMP: {".sv": "timestamp"},
        request: vi.fn(async (name, path, value, options) => {
            expect(name).toBe("database.update");
            expect(path).toEqual(["_activity"]);
            if (options.mode === "read") return {value: structuredClone(records), etag: String(revision)};
            if (options.etag !== String(revision)) return {committed: false, value: structuredClone(records), etag: String(revision)};
            records = value;
            revision++;
            return {committed: true, value: records};
        }),
        records: () => records,
    };
};

it("stores the original type in a record value and timestamps it through a conditional write", async () => {
    const backend = fakeBackend();
    await new ActivityListener(backend).onCreate({params, value: {type: "tag.create"}});
    expect(backend.records()).toEqual({a1: {activity_type_id: "a1", type: "tag.create", value: backend.TIMESTAMP}});
    expect(backend.request).toHaveBeenLastCalledWith("database.update", ["_activity"],
        {a1: {activity_type_id: "a1", type: "tag.create", value: backend.TIMESTAMP}}, {mode: "replace", etag: "0"});
});
it.each([null, undefined, "", 0, {}, []])("rejects an invalid type %j before writing", async type => {
    const backend = {request: vi.fn()};
    await expect(new ActivityListener(backend).onCreate({params, value: {type}})).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(backend.request).not.toHaveBeenCalled();
});
it("propagates update failure", async () => {
    const error = new Error("update failed");
    const backend = {request: vi.fn().mockRejectedValue(error)};
    await expect(new ActivityListener(backend).onCreate({params, value: {type: "service"}})).rejects.toBe(error);
});
it("keeps updates and deletions free of writes", async () => {
    const backend = {request: vi.fn()}; const listener = new ActivityListener(backend);
    await listener.onUpdate({params, value: {type: "service"}, previous: {type: "old"}});
    await listener.onDelete({params, value: {type: "service"}});
    expect(backend.request).not.toHaveBeenCalled();
});
it("reuses a service ID, preserves other types and discards the disposable legacy map", async () => {
    const backend = fakeBackend({types: {old: 1}, first: {type: "tag.create", value: 1}, other: {type: "tag.delete", value: 2}});
    await new ActivityListener(backend).onCreate({params, value: {type: "tag.create"}});
    expect(backend.records()).toEqual({
        first: {activity_type_id: "first", type: "tag.create", value: backend.TIMESTAMP},
        other: {activity_type_id: "other", type: "tag.delete", value: 2},
    });
});

it("retries concurrent changes without duplicating types or losing other records", async () => {
    const backend = fakeBackend();
    const listener = new ActivityListener(backend);
    vi.spyOn(Math, "random").mockReturnValue(0);
    await Promise.all(["tag.create", "tag.create", "tag.delete", "tag.create"].map((type, i) =>
        listener.onCreate({params: {activity_id: `a${i}`}, value: {type}})));
    expect(Object.values(backend.records()).map(record => record.type).sort()).toEqual(["tag.create", "tag.delete"]);
});

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
it("updates type records through the real Local creation chain and reads their types through a cursor", async () => {
    const storageId = "activity-listener";
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["activity"]);
    await backend.request("database.update", ["_activity", {activity_type_id: "other"}],
        {activity_type_id: "other", type: "tag.delete", value: 2});
    const key = await createActivity(backend, {uid: "user", type: "tag.create", details: "hello"});
    await vi.waitFor(async () => {
        const records = await database.read(["_activity"]);
        expect(records[key]).toEqual({activity_type_id: key, type: "tag.create", value: expect.any(Number)});
        expect(records.other).toEqual({activity_type_id: "other", type: "tag.delete", value: 2});
    });
    expect(await database.read(["activity", {activity_id: key}])).toMatchObject({uid: "user", type: "tag.create", details: "hello"});
    await createActivity(backend, {type: "tag.create"});
    await vi.waitFor(async () => {
        expect(Object.keys(await database.read(["activity"]))).toHaveLength(2);
    });
    const cursor = database.cursor(["_activity", "activity_type_id"], {orderBy: "type", equalTo: "tag.create"});
    expect(await cursor.next(10)).toEqual([{key, value: {activity_type_id: key, type: "tag.create", value: expect.any(Number)}}]);
    const records = await database.read(["_activity"]);
    expect(Object.keys(records)).toHaveLength(2);
});

it("commits concurrent Local events as one record per type", async () => {
    const storageId = "activity-concurrent";
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["_activity"]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const listener = new ActivityListener(backend);
    await Promise.all(["tag.create", "tag.create", "tag.delete", "tag.create"].map((type, i) =>
        listener.onCreate({params: {activity_id: `a${i}`}, value: {type}})));
    const records = Object.values(await database.read(["_activity"]));
    expect(records.map(record => record.type).sort()).toEqual(["tag.create", "tag.delete"]);
    expect(records.every(record => typeof record.value === "number")).toBe(true);
});

it("restores a cleared derived activity index from the source journal on explicit rebuild", async () => {
    const storageId = "activity-rebuild";
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId, backend});
    await database.read(["activity"]);
    const first = await createActivity(backend, {type: "tag.create"});
    await createActivity(backend, {type: "tag.create"});
    const third = await createActivity(backend, {type: "tag.delete"});
    await vi.waitFor(async () => expect(Object.keys(await database.read(["_activity"]))).toHaveLength(2));
    await backend.request("database.update", ["_activity"], {}, {mode: "replace",
        etag: (await backend.request("database.update", ["_activity"], null, {mode: "read"})).etag});
    expect(await database.read(["_activity"])).toBeUndefined();
    expect(Object.keys(await database.read(["activity"]))).toHaveLength(3);
    await new ActivityListener(backend).rebuild();
    const records = await database.read(["_activity"]);
    expect(records).toEqual({
        [first]: {activity_type_id: first, type: "tag.create", value: expect.any(Number)},
        [third]: {activity_type_id: third, type: "tag.delete", value: expect.any(Number)},
    });
    expect((await database.cursor(["_activity", "activity_type_id"],
        {orderBy: "type", equalTo: "tag.create"}).next(10)).map(({key}) => key)).toEqual([first]);
});
