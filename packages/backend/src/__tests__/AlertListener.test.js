import AlertListener from "../common/handlers/alerts";

let backend, listener;
const params = {user_id: "recipient", alert_id: "a1"};
const value = {uid: "author", type: "like"};
beforeEach(() => {
    backend = {projectTitle: "App", projectUrl: "https://app.test", request: vi.fn(async (name, path) =>
        name === "database.read" ? "Alice" : [])};
    listener = new AlertListener(backend);
});
it.each([
    ["like", "liked your post"], ["posts", "mentioned you"], ["replies", "replied to your post"],
    ["subreplies", "replied to your reply"], ["request", "invited you"],
])("sends %s through the user notification contract", async (type, suffix) => {
    await listener.onCreate({params, value: {...value, type}});
    const payload = {userId: "recipient", data: {body: `Alice ${suffix}`,
        tag: "https://app.test/alerts/", type: "alert"}};
    expect(backend.request.mock.calls).toEqual([
        ["database.read", ["users_public", {user_id: "author"}, {name: "name"}]],
        ["notification.send", payload],
    ]);
});
it.each([null, ""])("uses Somebody for missing name %j", async name => {
    backend.request.mockResolvedValueOnce(name);
    await listener.onCreate({params, value});
    expect(backend.request.mock.calls[1][1].data.body).toBe("Somebody liked your post");
});
it("logs a name lookup failure and still sends", async () => {
    const error = new Error("name failed");
    vi.spyOn(console, "error").mockImplementation(() => {});
    backend.request.mockRejectedValueOnce(error);
    await listener.onCreate({params, value});
    expect(console.error).toHaveBeenCalledWith(error);
    expect(backend.request.mock.calls[1][1].data.body).toBe("Somebody liked your post");
});
it.each(["unknown", "toString"])("rejects unknown type %s", async type => {
    await expect(listener.onCreate({params, value: {...value, type}})).rejects.toThrow(`${type} is not defined`);
    expect(backend.request).not.toHaveBeenCalled();
});
it.each([2])("propagates failure at operation %s and stops", async operation => {
    const invoke = backend.request.getMockImplementation();
    const error = new Error("failed"); let calls = 0;
    backend.request.mockImplementation((...args) => ++calls === operation ? Promise.reject(error) : invoke(...args));
    await expect(listener.onCreate({params, value})).rejects.toBe(error);
    expect(backend.request).toHaveBeenCalledTimes(operation);
});
it("exposes only the alert creation reaction", () => {
    expect(listener.onUpdate).toBeUndefined();
    expect(listener.onDelete).toBeUndefined();
});
