import {vi} from "vitest";
import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

let fixture, database;
beforeEach(() => {
    fixture = createFirebase();
    database = new FirebaseDatabase({firebase: fixture.firebase});
});
it("normalizes value/child events and removes the exact registered callbacks", () => {
    const onChange = vi.fn(), onChildAdd = vi.fn(), onChildChange = vi.fn(), onChildRemove = vi.fn();
    const listener = database.addEventListener(["records"], {onChange, onChildAdd, onChildChange, onChildRemove, orderBy: "score"});
    const registrations = [...fixture.sdk.listeners];
    expect(registrations.map(item => item.type)).toEqual(["value", "child_added", "child_changed", "child_removed"]);
    expect(registrations.find(item => item.type === "child_added").ref.query).toEqual({orderByKey: []});
    fixture.emit("value", {a: 1});
    expect(onChange).toHaveBeenLastCalledWith({a: 1});
    fixture.emit("child_added", {score: 2}, "b");
    expect(onChildAdd).toHaveBeenCalledExactlyOnceWith({key: "b", value: {score: 2}});
    for (const [type, callback] of [["child_added", onChildAdd], ["child_changed", onChildChange], ["child_removed", onChildRemove]]) {
        fixture.emit(type, {score: 2}, "a");
        if (type === "child_added") expect(callback).toHaveBeenCalledOnce();
        else expect(callback).toHaveBeenCalledExactlyOnceWith({key: "a", value: {score: 2}});
    }
    listener.remove();
    expect(fixture.sdk.listeners).toHaveLength(0);
    for (const {ref, type, callback} of registrations) expect(fixture.sdk.off).toHaveBeenCalledWith(ref, type, callback);
    expect(() => listener.remove()).not.toThrow();
});
it("keeps independent listeners and reports callback/SDK cancellation errors", () => {
    const first = vi.fn(), second = vi.fn(), onError = vi.fn();
    const a = database.addEventListener("records", {onChildAdd: first});
    const b = database.addEventListener("records", {onChildAdd: second});
    a.remove();fixture.emit("value", null);fixture.emit("child_added", 1, "a");
    expect(first).not.toHaveBeenCalled();expect(second).toHaveBeenCalledOnce();b.remove();
    const error = new Error("callback");
    const listener = database.addEventListener("records", {onChildChange: () => { throw error; }, onError});
    fixture.emit("child_changed", 2, "b");
    expect(onError).toHaveBeenLastCalledWith(error, "addEventListener.onChildChange", {path: "records", entry: {key: "b", value: 2}});
    const cancelled = new Error("permission");fixture.sdk.listeners[0].onError(cancelled);
    expect(onError).toHaveBeenLastCalledWith(cancelled, "addEventListener", {path: "records", orderBy: undefined});
    listener.remove();
});
it("rejects nonfunction handlers and cleans up partial registration failures", () => {
    expect(() => database.addEventListener("records", {onChildAdd: true})).toThrow();
    expect(fixture.sdk.listeners).toHaveLength(0);
    const error = new Error("cannot listen"), onError = vi.fn();
    fixture.sdk.on.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw error; });
    expect(database.addEventListener("records", {onChange: vi.fn(), onChildAdd: vi.fn(), onError})).toBeUndefined();
    expect(fixture.sdk.listeners).toHaveLength(0);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "addEventListener", {path: "records", orderBy: undefined});
});

it("buffers events until the initial boundary and applies Firebase numeric key order", () => {
    const added = vi.fn();
    const listener = database.addEventListener("records", {onChildAdd: added});
    fixture.emit("child_added", 1, "2");
    fixture.emit("child_added", 2, "11");
    expect(added).not.toHaveBeenCalled();
    fixture.emit("value", {"2": 1, "10": 1});
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "11", value: 2});
    fixture.emit("child_added", 3, "9");
    fixture.emit("child_added", 4, "10");
    fixture.emit("child_added", 5, "12");
    expect(added).toHaveBeenCalledTimes(2);
    expect(added).toHaveBeenLastCalledWith({key: "12", value: 5});
    fixture.emit("child_removed", 1, "10");
    fixture.emit("child_added", 6, "9");
    expect(added).toHaveBeenCalledTimes(2);
    listener.remove();
    fixture.emit("child_added", 7, "13");
    expect(added).toHaveBeenCalledTimes(2);
});

it("uses numeric ordering for signed and padded child keys", () => {
    const added = vi.fn();
    database.addEventListener("records", {onChildAdd: added});
    fixture.emit("value", {"-2": true, "2": true});
    fixture.emit("child_added", true, "02");
    fixture.emit("child_added", true, "-1");
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "02", value: true});
});

it("emits additions from an initially empty collection and drops buffered events on removal", () => {
    const added = vi.fn();
    const listener = database.addEventListener("records", {onChildAdd: added});
    fixture.emit("value", null);
    fixture.emit("child_added", 1, "a");
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "a", value: 1});
    listener.remove();
    const pending = vi.fn();
    database.addEventListener("records", {onChildAdd: pending}).remove();
    fixture.emit("value", null);
    expect(pending).not.toHaveBeenCalled();
});

it("treats a write included in the first value snapshot as baseline even if its child event was buffered", () => {
    const added = vi.fn();
    database.addEventListener("records", {onChildAdd: added});
    fixture.emit("child_added", 1, "a");
    fixture.emit("value", {a: 1});
    expect(added).not.toHaveBeenCalled();
    fixture.emit("child_added", 2, "b");
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "b", value: 2});
});

it("buffers a child delivered before the first value callback when absent from that snapshot", () => {
    const added = vi.fn();
    database.addEventListener("records", {onChildAdd: added});
    fixture.emit("child_added", 2, "b");
    fixture.emit("value", {a: 1});
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "b", value: 2});
});

it("registers a discover notification listener on its own path, separate from posts", () => {
    const added = vi.fn();
    const removed = vi.fn();
    const listener = database.addEventListener("discover/viewer", {
        onChildAdd: added,
        onChildRemove: removed
    });
    expect(fixture.sdk.listeners.map(({ref, type}) => [ref.path, type])).toEqual([
        ["discover/viewer", "value"],
        ["discover/viewer", "child_added"],
        ["discover/viewer", "child_removed"]
    ]);
    fixture.emit("value", null);
    fixture.emit("child_added", "author", "post-1");
    expect(added).toHaveBeenCalledExactlyOnceWith({key: "post-1", value: "author"});
    fixture.emit("child_removed", "author", "post-1");
    expect(removed).toHaveBeenCalledExactlyOnceWith({key: "post-1", value: "author"});
    listener.remove();
    expect(fixture.sdk.listeners).toHaveLength(0);
});

it.each(["", []])("retains root subscriptions for %j", path => {
    const listener = database.addEventListener(path, {onChange: vi.fn()});
    expect(fixture.sdk.listeners[0].ref.path).toBe("");
    listener.remove();
    expect(fixture.sdk.listeners).toHaveLength(0);
});

it("uses the same address as read and cursor for an identity marker", async () => {
    const path = Object.freeze(["users_public", "user_id"]);
    const listener = database.addEventListener(path, {onChange: vi.fn()});
    await database.read(path);
    expect(fixture.sdk.listeners[0].ref.path).toBe("users_public");
    expect(fixture.sdk.once.mock.calls[0][0].path).toBe("users_public");
    expect(database.cursor(path).path).toBe("users_public");
    expect(path).toEqual(["users_public", "user_id"]);
    listener.remove();
});
