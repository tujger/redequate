import listener from "../firebase-server/src/database/onEvents";
import {oncreate, ondelete, onupdate} from "../firebase-server/src/database";
import {extra as ExtraListener, post as PostListener} from "../common/handlers";
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
    [["posts", {post_id: "p1"}], "posts/p1"],
    [["posts", {post_id: "{postId}", _: {label: "ignored"}}, {field: "text"}], "posts/{postId}/text"],
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

it.each([[null], [[]], [["posts", {post_id: ""}]], [["posts", {a: "1", b: "2"}]]])(
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

it("exports only the three production trigger groups", () => {
    for (const group of [oncreate, ondelete, onupdate]) expect(Object.keys(group)).toEqual(["extra", "post"]);
});

it.each(types)("runs the extra %s behavior", async (type, name, suffix, before, after) => {
    const value = {id: "p", type: "like"};
    const backend = {increment: vi.fn(n => ({delta: n})), request: vi.fn()};
    const log = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
        await new ExtraListener(backend)[name](payload(type, value, value));
        expect(log).toHaveBeenCalledWith("[Backend:Extra]", `${{create: "added", delete: "deleted", update: "changed"}[type]} e1`, expect.any(Object));
        expect(backend.request).toHaveBeenCalledTimes(type === "update" ? 0 : 1);
        if (type !== "update") expect(backend.request).toHaveBeenCalledWith("database.update", ["_counters", {id: "p"}, "like"], {delta: type === "create" ? 1 : -1});
    } finally { log.mockRestore(); }
});

it.each(types)("runs the post %s counters in order", async (type, name) => {
    const backend = {increment: vi.fn(n => ({delta: n})), request: vi.fn()};
    const value = {uid: "u"};
    await new PostListener(backend)[name](payload(type, value, value, {post_id: "p"}));
    expect(backend.request.mock.calls).toEqual(type === "update" ? [] : [
        ["database.update", ["_counters", {id: "total"}, "posts"], {delta: type === "create" ? 1 : -1}],
        ["database.update", ["_counters", {id: "u"}, "posts"], {delta: type === "create" ? 1 : -1}],
    ]);
});

it("skips a missing post owner and stops after a failed total counter update", async () => {
    const backend = {increment: n => ({delta: n}), request: vi.fn()};
    await new PostListener(backend).onCreate({value: {}, params: {post_id: "p"}});
    expect(backend.request).toHaveBeenCalledTimes(1);
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
