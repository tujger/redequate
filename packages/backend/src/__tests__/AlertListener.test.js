import AlertListener from "../common/handlers/alert";

let backend, listener;
const params = {user_id: "recipient", alert_id: "a1"};
const value = {uid: "author", type: "like"};
beforeEach(() => {
    backend = {projectTitle: "App", projectUrl: "https://app.test", request: vi.fn(async (name, path) =>
        name !== "database.read" ? [] : path[0] === "users_public" ? "Alice" : {one: {notification: "t1"}, empty: {}, missing: null, two: {notification: "t2"}})};
    listener = new AlertListener(backend);
});
it.each([
    ["like", "liked your post"], ["posts", "mentioned you"], ["replies", "replied to your post"],
    ["subreplies", "replied to your reply"], ["request", "invited you"],
])("sends %s with the original payload to each device in order", async (type, suffix) => {
    await listener.onCreate({params, value: {...value, type}});
    const payload = {data: {body: `Alice ${suffix}`, icon: "https://app.test/logo-192.png",
        tag: "https://app.test/alerts/", title: "App", type: "alert"}};
    expect(backend.request.mock.calls).toEqual([
        ["database.read", ["users_public", {user_id: "author"}, {name: "name"}]],
        ["database.read", ["users_private", {user_id: "recipient"}]],
        ["notification.send", ["t1"], payload, {}], ["notification.send", ["t2"], payload, {}],
    ]);
});
it.each([null, ""])("uses Somebody for missing name %j", async name => {
    backend.request.mockResolvedValueOnce(name);
    await listener.onCreate({params, value});
    expect(backend.request.mock.calls[2][2].data.body).toBe("Somebody liked your post");
});
it("logs a name lookup failure and still sends", async () => {
    const error = new Error("name failed");
    vi.spyOn(console, "error").mockImplementation(() => {});
    backend.request.mockRejectedValueOnce(error);
    await listener.onCreate({params, value});
    expect(console.error).toHaveBeenCalledWith(error);
    expect(backend.request.mock.calls[2][2].data.body).toBe("Somebody liked your post");
});
it.each([null, {}, {one: null, two: {}}])("skips absent tokens %j", async devices => {
    backend.request.mockResolvedValueOnce("Alice").mockResolvedValueOnce(devices);
    await listener.onCreate({params, value});
    expect(backend.request).toHaveBeenCalledTimes(2);
});
it.each(["unknown", "toString"])("rejects unknown type %s", async type => {
    await expect(listener.onCreate({params, value: {...value, type}})).rejects.toThrow(`${type} is not defined`);
    expect(backend.request).not.toHaveBeenCalled();
});
it.each([2, 3])("propagates failure at operation %s and stops", async operation => {
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
