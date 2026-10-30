import listener from "../firebase-server/src/database/onEvents";
import {oncreate, ondelete, onupdate} from "../firebase-server/src/database";
import {alert as AlertListener, extra as ExtraListener, post as PostListener} from "../common/handlers";
import BackendListener from "../common/BackendListener";

const snapshot = value => ({val: () => value});
const event = (type, before, after, params = {extra_id: "e1"}) => ({
    data: type === "create" ? snapshot(after) : type === "delete" ? snapshot(before)
        : {before: snapshot(before), after: snapshot(after)}, params,
});
const types = [
    ["create", "onCreate", "created", null, {text: "created"}],
    ["delete", "onDelete", "deleted", {text: "deleted"}, null],
    ["update", "onUpdate", "updated", {text: "before"}, {text: "after"}],
];
const payload = (type, before, after, params = {extra_id: "e1"}) => type === "update"
    ? {value: after, previous: before, params} : {value: type === "delete" ? before : after, params};

it.each([
    ["/posts//p1/", "posts/p1"],
    [["extra", "extra_id"], "extra/{extra_id}"],
    [["alerts", "user_id", "alert_id"], "alerts/{user_id}/{alert_id}"],
    [["alerts", {user_id: "u1"}, "alert_id"], "alerts/u1/{alert_id}"],
    [["posts", {post_id: "p1"}], "posts/p1"],
    [["posts", {post_id: "{postId}"}, {field: "text"}], "posts/{postId}/text"],
    ["posts/{postId}", "posts/{postId}"],
])("registers each event at database path %j", (path, ref) => {
    const triggers = listener({path, onCreate() {}, onDelete() {}, onUpdate() {}});
    for (const [type, name, suffix] of types) {
        expect(triggers[name].__endpoint.eventTrigger).toMatchObject({
            eventType: `google.firebase.database.ref.v1.${suffix}`,
            eventFilterPathPatterns: {ref, instance: "*"},
        });
    }
});

it.each([[null], [[]], [["posts", {post_id: ""}]], [["posts", {a: "1", b: "2"}]], [["alerts", "user_id", "user_id"]], [["alerts", "bad/name"]], [["posts", {post_id: "p1", _: true}]]])(
    "rejects an invalid path %j", path => {
        expect(() => listener({path, onCreate() {}})).toThrow();
    }
);

it.each(types)("delivers only %s with plain snapshots and preserves the result", async (type, name, suffix, before, after) => {
    const callbacks = {onCreate: vi.fn(), onDelete: vi.fn(), onUpdate: vi.fn()};
    callbacks[name].mockResolvedValue(type);
    const triggers = listener({path: new ExtraListener({}).path, ...callbacks});
    expect(await triggers[name].run(event(type, before, after))).toBe(type);
    expect(callbacks[name]).toHaveBeenCalledExactlyOnceWith(payload(type, before, after));
    for (const other of Object.keys(callbacks).filter(key => key !== name)) expect(callbacks[other]).not.toHaveBeenCalled();
});

it.each(types)("propagates %s callback errors", async (type, name, suffix, before, after) => {
    const error = new Error("callback failed");
    const triggers = listener({path: new ExtraListener({}).path, [name]: async () => { throw error; }});
    await expect(triggers[name].run(event(type, before, after))).rejects.toBe(error);
    const synchronous = listener({path: new ExtraListener({}).path, [name]: () => { throw error; }});
    expect(() => synchronous[name].run(event(type, before, after))).toThrow(error);
});

it.each(types)("keeps the listener instance as this for %s", async (type, name, suffix, before, after) => {
    class StatefulListener extends BackendListener {
        constructor(backend) { super(["extra", "extra_id"], backend); this.calls = []; }
        onCreate(props) { this.calls.push({props, backend: this.backend}); return "created"; }
        onDelete(props) { this.calls.push({props, backend: this.backend}); return "deleted"; }
        onUpdate(props) { this.calls.push({props, backend: this.backend}); return "updated"; }
    }
    const backend = {};
    const instance = new StatefulListener(backend);
    expect(await listener(instance)[name].run(event(type, before, after))).toBe(suffix);
    expect(instance.calls).toEqual([{props: payload(type, before, after), backend}]);
});

it("exports the supported production trigger groups", () => {
    expect(Object.keys(oncreate)).toEqual(["activity", "alert", "extra", "post", "tag"]);
    expect(Object.keys(ondelete)).toEqual(["activity", "extra", "post", "tag"]);
    expect(Object.keys(onupdate)).toEqual(["activity", "post", "tag"]);
});

it.each(types.filter(([type]) => type !== "update"))("runs the extra %s behavior", async (type, name, suffix, before, after) => {
    const value = {id: "p", type: "like"};
    const backend = {request: vi.fn(async (name, path, value, options) => name !== "database.update" ? null
        : options.mode === "read" ? {value: null, etag: "initial"} : {committed: true, value})};
    const log = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
        await new ExtraListener(backend)[name](payload(type, value, value));
        expect(log).toHaveBeenCalledWith("[Backend:Extra]", expect.any(String), expect.any(Object));
        expect(backend.request).toHaveBeenCalledTimes(type === "create" ? 3 : type === "update" ? 0 : 2);
        if (type !== "update") expect(backend.request).toHaveBeenCalledWith("database.update", ["_counters", {id: "p"}, "like"], type === "create" ? 1 : null, {mode: "replace", etag: "initial"});
    } finally { log.mockRestore(); }
});

it.each(types)("runs the post %s counters in order", async (type, name) => {
    const backend = {request: vi.fn(async (name, path, value, options) => name === "database.read" ? null
        : options?.mode === "read" ? {value: 1, etag: "initial"} : {committed: true, value})};
    const value = {uid: "u"};
    await new PostListener(backend)[name](payload(type, value, value, {post_id: "p"}));
    const counter = id => ["_counters", {id}, "posts"];
    const changes = id => [
        ["database.update", counter(id), null, {mode: "read"}],
        ["database.update", counter(id), type === "create" ? 2 : null, {mode: "replace", etag: "initial"}],
    ];
    expect(backend.request.mock.calls).toEqual(type === "update" ? [] : type === "create"
        ? [...changes("total"), ...changes("u")]
        : [...changes("u"), ...changes("total"), ["database.read", ["posts"], {orderBy: "to", equalTo: "p"}]]);
});

it("skips a missing post owner and stops after a failed total counter update", async () => {
    const backend = {increment: n => ({delta: n}), request: vi.fn(async (name, path, value, options) =>
        options?.mode === "read" ? {value: null, etag: "initial"} : {committed: true, value})};
    await new PostListener(backend).onCreate({value: {}, params: {post_id: "p"}});
    expect(backend.request).toHaveBeenCalledTimes(2);
    backend.request.mockClear().mockRejectedValueOnce(new Error("counter failed"));
    await expect(new PostListener(backend).onDelete({value: {uid: "u"}, params: {post_id: "p"}})).rejects.toThrow("counter failed");
    expect(backend.request).toHaveBeenCalledTimes(1);
});

it("keeps Firebase listener contexts isolated between registrations", async () => {
    class ContextListener extends BackendListener {
        constructor(backend) { super(["extra", "extra_id"], backend); this.seen = []; }
        onCreate(props) { this.seen.push({backend: this.backend, props}); }
    }
    const firstBackend = {}, secondBackend = {};
    const first = new ContextListener(firstBackend), second = new ContextListener(secondBackend);
    await listener(first).onCreate.run(event("create", null, {id: "one"}));
    await listener(second).onCreate.run(event("create", null, {id: "two"}));
    expect(first.seen).toEqual([{backend: firstBackend, props: {value: {id: "one"}, params: {extra_id: "e1"}}}]);
    expect(second.seen).toEqual([{backend: secondBackend, props: {value: {id: "two"}, params: {extra_id: "e1"}}}]);
});


it.each(types.filter(([type]) => type === "create"))("delivers alert %s with both wildcard parameters", async (type, name, suffix, before, after) => {
    const instance = new AlertListener({});
    const callback = vi.spyOn(instance, name).mockResolvedValue("done");
    const params = {user_id: "u1", alert_id: "a1"};
    expect(await listener(instance)[name].run(event(type, before, after, params))).toBe("done");
    expect(callback).toHaveBeenCalledExactlyOnceWith(payload(type, before, after, params));
});

it("includes fixed named parameters alongside captured Firebase parameters", async () => {
    const callback = vi.fn();
    const triggers = listener({path: ["alerts", {user_id: "u1"}, "alert_id"], onCreate: callback});
    await triggers.onCreate.run(event("create", null, {new: true}, {alert_id: "a1"}));
    expect(callback).toHaveBeenCalledExactlyOnceWith({value: {new: true}, params: {user_id: "u1", alert_id: "a1"}});
});
