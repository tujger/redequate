import {vi} from "vitest";
import DatabaseCursor from "../../common/DatabaseCursor";
import FirebaseDatabase from "../../firebase";
import FirebaseCursor from "../../firebase/cursor";
import {createFirebase} from "../fixtures/firebase";

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

class RecordsCursor extends DatabaseCursor {
    constructor(entries, options = {}, path) {
        super(options, path);
        this.entries = [...entries];
    }
    async next(n = 1) {
        const heading = await super.next(n);
        const result = [...heading, ...this.entries.splice(0, n)];
        this._count += result.length;
        this._position = Object.freeze({
            index: this.position.index + result.length,
            key: result.at(-1)?.key ?? this.position.key,
            finished: !this.entries.length
        });
        return result;
    }
}
const record = (key, value = key) => ({key, value});
let fixture, database;
beforeEach(() => {
    fixture = createFirebase();
    database = new FirebaseDatabase({firebase: fixture.firebase});
});

it("uses the same composition implementation for one or multiple sources", () => {
    expect(database.cursor("records")).not.toBeInstanceOf(FirebaseCursor);
    expect(database.cursor(["records"]).path).toBe("records");
    expect(database.cursor("records").constructor).toBe(database.cursor([{path: "records"}]).constructor);
    expect(database.cursor(["records"]).constructor).toBe(database.cursor([{path: "records"}]).constructor);
});
it("deduplicates equivalent custom cursor paths across nested round-robin compositions", async () => {
    const a = new RecordsCursor([record("a"), record("b")], {}, ["/records/"]);
    const b = new RecordsCursor([record("a"), record("c")], {}, "records");
    const nested = database.cursor([a, new RecordsCursor([record("a", "other")], {}, "other")]);
    const cursor = database.cursor([nested, b]);
    expect(await cursor.next(10)).toEqual([record("a"), record("a", "other"), record("c"), record("b")]);
    expect(cursor.position.finished).toBe(true);
    expect(cursor.count).toBe(4);
});
it("uses ids for pathless sources without colliding with path identities", async () => {
    const cursor = database.cursor([
        database.cursor([new RecordsCursor([record("x")], {id: "shared"})]),
        new RecordsCursor([record("x", "duplicate")], {id: "shared"}),
        new RecordsCursor([record("x", "different id")], {id: "other"}),
        new RecordsCursor([record("x", "path")], {}, "shared")
    ]);
    expect(await cursor.next(10)).toEqual([record("x"), record("x", "different id"), record("x", "path")]);
});
it("preserves provenance when two custom sources return the same entry object", async () => {
    const shared = record("x");
    const inner = database.cursor([new RecordsCursor([shared], {}, "a"), new RecordsCursor([shared], {}, "b")]);
    const outer = database.cursor([inner, new RecordsCursor([record("x", "duplicate")], {}, "b")]);
    expect(await outer.next(10)).toEqual([shared, record("x", "duplicate")]);
    // The remaining b entry from inner was deduplicated; a remained independent.
});
it("preserves grouped blocks, ancestor headings and duplicate-only suppression", async () => {
    const nested = database.cursor([
        new RecordsCursor([record("a")], {group: "First"}, "same"),
        new RecordsCursor([record("a")], {group: "Duplicate"}, "same"),
        new RecordsCursor([record("b")], {group: "Second"}, "second")
    ], {group: "Parent"});
    const cursor = database.cursor([nested, new RecordsCursor([], {group: "Empty"}, "empty")]);
    const result = await cursor.next(1);
    expect(result).toEqual([
        {key: "Parent"}, {key: "First"}, record("a"),
        {key: "Second"}, record("b")
    ]);
    expect(cursor.count).toBe(5);
    expect(await cursor.next(1)).toEqual([]);
    expect(cursor.position.finished).toBe(true);
});
it("does not mistake stored group fields for synthetic headings", async () => {
    const cursor = database.cursor([
        new RecordsCursor([record("a", {group: "stored data"})], {group: "Heading"}, "records")
    ]);
    expect(await cursor.next(1)).toEqual([{key: "Heading"}, record("a", {group: "stored data"})]);
});
it("keeps deferred headings until a unique record survives in a later page", async () => {
    const cursor = database.cursor([
        new RecordsCursor([record("a")], {group: "First"}, "same"),
        new RecordsCursor([record("a"), record("b")], {group: "Later"}, "same")
    ]);
    expect(await cursor.next(1)).toEqual([{key: "First"}, record("a")]);
    expect(await cursor.next(1)).toEqual([{key: "Later"}, record("b")]);
});
it("retains a Firebase heading after an asynchronous handler failure", async () => {
    const onError = vi.fn();let failed = false;
    fixture.sdk.once.mockResolvedValue(fixture.snapshot({a: 1}));
    const cursor = database.cursor("records", {group: "Records", onError, handle: async () => {
        if (!failed) { failed = true; throw new Error("retry"); }
    }});
    expect(await cursor.next(2)).toBeUndefined();
    expect(cursor.count).toBe(0);expect(cursor.position.index).toBe(-1);
    expect(await cursor.next(2)).toEqual([{key: "Records"}, record("a", 1)]);
    expect(cursor.count).toBe(2);
});
it("rejects repeated or consumed instances with one lifecycle check", async () => {
    const cursor = new RecordsCursor([record("a")]);
    expect(() => database.cursor([cursor, cursor])).toThrow();
    await cursor.next();
    expect(() => database.cursor([cursor])).toThrow();
    const empty = new RecordsCursor([]);await empty.next();
    expect(() => database.cursor([empty])).toThrow();
});
it.each(["single", "composed", "nested", "ready"])("reports a throwing error handler once for %s sources", async kind => {
    const original = new Error("query"), replacement = new Error("handler");
    const onError = vi.fn(() => { throw replacement; });
    fixture.sdk.once.mockRejectedValue(original);
    let cursor = database.cursor("records", {onError});
    if (kind === "composed") cursor = database.cursor([{path: "records"}], {onError});
    if (kind === "nested") cursor = database.cursor([database.cursor([{path: "records"}], {onError})], {onError});
    if (kind === "ready") cursor = database.cursor([cursor], {onError});
    await expect(cursor.next()).rejects.toBe(replacement);
    expect(onError).toHaveBeenCalledExactlyOnceWith(original, "cursor.next", {path: "records", n: 1});
});
it("honors source-specific suppression without calling the outer handler", async () => {
    const sourceError = vi.fn(), outerError = vi.fn();
    fixture.sdk.once.mockRejectedValue(new Error("query"));
    const cursor = database.cursor([{path: "records", onError: sourceError}], {onError: outerError});
    expect(await cursor.next()).toBeUndefined();
    expect(sourceError).toHaveBeenCalledTimes(1);expect(outerError).not.toHaveBeenCalled();
});
it("cleans every source after one unsubscribe fails", () => {
    const off = vi.fn(), onError = vi.fn(() => { throw new Error("cleanup handler"); });
    class LiveCursor extends RecordsCursor {
        subscribe(listener) {
            super.subscribe(listener);
            return {unsubscribe: () => { off();if (this.path === "a") throw new Error("off"); }};
        }
    }
    const cursor = database.cursor([new LiveCursor([], {}, "a"), new LiveCursor([], {}, "b")], {onError});
    const subscription = cursor.subscribe(vi.fn());
    expect(() => subscription.unsubscribe()).toThrow("cleanup handler");
    expect(off).toHaveBeenCalledTimes(2);expect(subscription.active).toBe(false);
    subscription.unsubscribe();expect(off).toHaveBeenCalledTimes(2);
});
it("keeps independent nested subscriptions and their metadata", async () => {
    const cursor = database.cursor([database.cursor([{path: "records"}])]);
    const first = vi.fn(), second = vi.fn();
    const a = cursor.subscribe(first), b = cursor.subscribe(second);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.emit("child_added", 1, "new");
    expect(first).toHaveBeenCalledTimes(1);expect(second).toHaveBeenCalledTimes(1);
    expect(cursor.count).toBe(2);
    expect(a).toMatchObject({id: cursor.id, active: true, added: 1});
    a.unsubscribe();fixture.emit("child_changed", 2, "new");
    expect(first).toHaveBeenCalledTimes(1);expect(second).toHaveBeenCalledTimes(2);
    expect(b.changed).toBe(1);b.unsubscribe();
    expect(fixture.sdk.listeners).toHaveLength(0);
});
it("routes invalid source options to their own handler once", () => {
    const outer = vi.fn(), replacement = new Error("handler");
    const source = vi.fn(() => { throw replacement; });
    expect(() => database.cursor([{path: "records", order: "invalid", onError: source}], {onError: outer})).toThrow(replacement);
    expect(source).toHaveBeenCalledTimes(1);expect(outer).not.toHaveBeenCalled();
});
it("does not report a synchronous Firebase cancellation handler failure twice", () => {
    const original = new Error("cancel"), replacement = new Error("handler");
    const onError = vi.fn(() => { throw replacement; });
    fixture.sdk.on.mockImplementation((ref, event, callback, report) => report(original));
    expect(() => database.cursor("records", {onError}).subscribe(vi.fn())).toThrow(replacement);
    expect(onError).toHaveBeenCalledExactlyOnceWith(original, "cursor.subscribe", {path: "records"});
    expect(fixture.sdk.listeners).toHaveLength(0);
});
it("does not report synchronous custom subscription callbacks twice", () => {
    const original = new Error("callback"), replacement = new Error("handler");
    const onError = vi.fn(() => { throw replacement; });
    class ImmediateCursor extends RecordsCursor {
        subscribe(listener) {
            super.subscribe(listener);listener({type: "add", entry: record("new")});
            return {unsubscribe() {}};
        }
    }
    const cursor = database.cursor([new ImmediateCursor([], {}, "records")], {onError});
    expect(() => cursor.subscribe(() => { throw original; })).toThrow(replacement);
    expect(onError).toHaveBeenCalledExactlyOnceWith(original, "cursor.subscribe", {path: "records"});
});

it("filters null and undefined sources, including an entirely empty composition", async () => {
    const cursor = database.cursor([undefined, new RecordsCursor([record("a")]), null]);
    expect(await cursor.next()).toEqual([record("a")]);
    for (const sources of [[undefined], [null], [null, undefined]]) {
        const empty = database.cursor(sources);
        expect(await empty.next()).toEqual([]);expect(empty.position.finished).toBe(true);
    }
});

it("preserves the original request in argument validation error contexts", async () => {
    const onError = vi.fn();
    const cursor = database.cursor(["records"], {onError});
    expect(await cursor.next(0)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), "cursor.next", {path: ["records"], n: 0});
    expect(cursor.subscribe(null)).toBeUndefined();
    expect(onError).toHaveBeenLastCalledWith(expect.any(Error), "cursor.subscribe", {path: ["records"]});
});
it("retains a parent group while suppressing a duplicate-only child group", async () => {
    const cursor = database.cursor([
        new RecordsCursor([record("a")], {}, "first"),
        database.cursor([
            new RecordsCursor([record("a")], {group: "Duplicate"}, "first"),
            new RecordsCursor([record("b")], {group: "Unique"}, "second")
        ], {group: "Parent"})
    ]);
    expect(await cursor.next(1)).toEqual([record("a"), {key: "Parent"}, {key: "Unique"}, record("b")]);
});
it.each([null, false, 0, ""])("keeps value %j as a record rather than a heading", async value => {
    const cursor = database.cursor([new RecordsCursor([record("a", value)], {group: "Records"}, "records")]);
    expect(await cursor.next()).toEqual([{key: "Records"}, record("a", value)]);
});

it("uses common resolved addresses for named roots, segments and slash variants", async () => {
    const cursor = database.cursor([
        new RecordsCursor([record("x"), record("y")], {}, [{type: "posts"}, {post_id: "p1"}]),
        new RecordsCursor([record("x"), record("z")], {}, "/posts//p1/"),
        new RecordsCursor([record("x")], {}, ["posts", {id: "p1", _: true}]),
        new RecordsCursor([record("x", "other")], {}, ["replies", {post_id: "p1"}])
    ]);
    const result = await cursor.next(10);
    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining([record("x"), record("y"), record("z"), record("x", "other")]));
    expect(cursor.count).toBe(4);
});
