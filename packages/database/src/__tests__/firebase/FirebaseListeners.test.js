import {vi} from "vitest";
import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

let fixture, database;
beforeEach(() => {
    fixture = createFirebase();
    database = new FirebaseDatabase({firebase: fixture.firebase});
});
it("normalizes value/child events and removes the exact registered callbacks", () => {
    const onChange = vi.fn(), onChildAdd = vi.fn(), onChildChange = vi.fn(), onChildRemove = vi.fn();
    const listener = database.addEventListener(["records"], {onChange, onChildAdd, onChildChange, onChildRemove, orderBy: "score"});
    const registrations = [...fixture.sdk.listeners];
    expect(registrations.find(item => item.type === "child_added").ref.query).toEqual({orderByChild: ["score"], limitToLast: [1]});
    fixture.emit("value", null);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    fixture.emit("value", {a: 1});
    expect(onChange).toHaveBeenLastCalledWith({a: 1});
    for (const [type, callback] of [["child_added", onChildAdd], ["child_changed", onChildChange], ["child_removed", onChildRemove]]) {
        fixture.emit(type, {score: 2}, "a");
        expect(callback).toHaveBeenCalledExactlyOnceWith({key: "a", value: {score: 2}});
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
    a.remove();fixture.emit("child_added", 1, "a");
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
