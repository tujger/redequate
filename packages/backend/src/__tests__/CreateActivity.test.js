import {createActivity} from "../common/handlers/activity";

it("creates an activity record with backend time and returns the generated key", async () => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue("activity-key")};
    const details = {message: "Maintenance started", nested: {enabled: true}};
    await expect(createActivity(backend, {uid: "user", type: "maintenance_start", details})).resolves.toBe("activity-key");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["activity", "activity_id"], {
        uid: "user", type: "maintenance_start", details, timestamp: backend.TIMESTAMP,
    });
});

it.each([undefined, {}, {uid: undefined, type: undefined, details: undefined}])("uses the original activity defaults for %j", async activity => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue("activity-key")};
    await createActivity(backend, activity);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["activity", "activity_id"], {
        uid: 0, type: null, details: null, timestamp: backend.TIMESTAMP,
    });
});

it("preserves explicitly supplied nullable and falsy values", async () => {
    const backend = {TIMESTAMP: 123, request: vi.fn()};
    await createActivity(backend, {uid: null, type: "", details: false});
    expect(backend.request.mock.calls[0][2]).toEqual({uid: null, type: "", details: false, timestamp: 123});
});

it("propagates creation failures", async () => {
    const error = new Error("creation failed");
    const backend = {request: vi.fn().mockRejectedValue(error)};
    await expect(createActivity(backend)).rejects.toBe(error);
});
