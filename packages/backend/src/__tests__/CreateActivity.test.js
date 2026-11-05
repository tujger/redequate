import {createActivity} from "../common/handlers/activity";

it("creates an activity record with backend time and returns the generated key", async () => {
    const backend = {getCurrentUser: vi.fn().mockResolvedValue(undefined), TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue("activity-key")};
    backend.getCurrentUser.mockResolvedValue("user");
    const details = {message: "Maintenance started", nested: {enabled: true}};
    await expect(createActivity(backend, {uid: "forged", type: "maintenance_start", details})).resolves.toBe("activity-key");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["activity", "activity_id"], {
        uid: "user", type: "maintenance_start", details, timestamp: backend.TIMESTAMP,
    });
});

it.each([undefined, {}, {uid: undefined, type: undefined, details: undefined}])("uses the original activity defaults for %j", async activity => {
    const backend = {getCurrentUser: vi.fn().mockResolvedValue(undefined), TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue("activity-key")};
    await createActivity(backend, activity);
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["activity", "activity_id"], {
        uid: 0, type: null, details: null, timestamp: backend.TIMESTAMP,
    });
});

it("preserves explicitly supplied nullable and falsy values", async () => {
    const backend = {getCurrentUser: vi.fn().mockResolvedValue(undefined), TIMESTAMP: 123, request: vi.fn()};
    await createActivity(backend, {uid: null, type: "", details: false});
    expect(backend.request.mock.calls[0][2]).toEqual({uid: 0, type: "", details: false, timestamp: 123});
});

it("propagates creation failures", async () => {
    const error = new Error("creation failed");
    const backend = {getCurrentUser: vi.fn().mockResolvedValue(undefined), request: vi.fn().mockRejectedValue(error)};
    await expect(createActivity(backend)).rejects.toBe(error);
});

it("propagates user resolution failures without writing", async () => {
    const failure = new Error("user resolution failed");
    const backend = {getCurrentUser: vi.fn().mockRejectedValue(failure), request: vi.fn()};
    await expect(createActivity(backend)).rejects.toBe(failure);
    expect(backend.request).not.toHaveBeenCalled();
});
