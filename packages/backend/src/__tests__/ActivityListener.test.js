import {IDBFactory} from "fake-indexeddb";
import ActivityListener, {createActivity} from "../common/handlers/activity";
import LocalBackend from "../local";
import LocalDatabase from "../../../database/src/local";

const params = {activity_id: "a1"};
it("registers a type through the backend using its timestamp", async () => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue(null)};
    await new ActivityListener(backend).onCreate({params, value: {type: "service"}});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.update", ["_activity", "types", "service"], backend.TIMESTAMP);
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
it("updates type timestamps through a real Local creation chain, preserving other types", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    try {
        const storageId = "activity-listener";
        const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId, backend});
        await database.read(["activity"]);
        await backend.request("database.update", ["_activity", "types"], {service: 1, other: 2});
        const key = await createActivity(backend, {uid: "user", type: "service", details: "hello"});
        await vi.waitFor(async () => {
            const types = await database.read(["_activity", "types"]);
            expect(types.service).toBeGreaterThan(1);
            expect(types.other).toBe(2);
        });
        expect(await database.read(["activity", {activity_id: key}])).toMatchObject({uid: "user", type: "service", details: "hello"});
        await createActivity(backend, {type: "new_type"});
        await vi.waitFor(async () => {
            const types = await database.read(["_activity", "types"]);
            expect(types.new_type).toEqual(expect.any(Number));
            expect(types.other).toBe(2);
            expect(types.service).toEqual(expect.any(Number));
        });
    } finally { vi.unstubAllGlobals(); }
});
