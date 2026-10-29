import {create} from "../common/handlers/alert";

it("creates the original alert shape and returns its key", async () => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue("a1")};
    await expect(create(backend, "recipient", {id: "p1", type: "like"})).resolves.toBe("a1");
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create",
        ["alerts", {user_id: "recipient"}, "alert_id"], {
            uid: null, context: null, id: "p1", message: null, new: true,
            path: null, timestamp: backend.TIMESTAMP, type: "like",
        });
});

it("preserves supplied alert details and uses the backend timestamp", async () => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue("a2")};
    const alert = {uid: "author", context: "context", id: "p1", message: "message", path: "/posts/p1", type: "posts"};
    await create(backend, "recipient", alert);
    expect(backend.request.mock.calls[0][2]).toEqual({...alert, new: true, timestamp: backend.TIMESTAMP});
});

it("propagates creation failures", async () => {
    const error = new Error("creation failed");
    const backend = {request: vi.fn().mockRejectedValue(error)};
    await expect(create(backend, "recipient", {id: "p1", type: "like"})).rejects.toBe(error);
});
