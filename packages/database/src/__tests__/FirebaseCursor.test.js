import {vi} from "vitest";
import {key as dateKey} from "firebase-key";
import FirebaseDatabase from "../firebase";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import {DatabaseCursor} from "../common/DatabaseCursor";
import DatabaseBase from "../common/DatabaseBase";
import FirebaseCursor from "../firebase/cursor";
import {createFirebase} from "./fixtures/firebase";

let fixture, database;
beforeEach(() => {
    fixture = createFirebase();
    database = new FirebaseDatabase({firebase: fixture.firebase});
});
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

it("starts before the first record, exposes readonly metadata and has no reset", () => {
    const a = database.cursor("records"), b = database.cursor("records");
    expect(a.id).not.toBe(b.id);
    expect(a.order).toBe("asc");expect(a.count).toBe(0);
    expect(a.position).toEqual({index: -1, key: undefined, finished: false});
    expect(a).not.toHaveProperty("reset");
    expect(Reflect.set(a, "count", 99)).toBe(false);
    expect(Reflect.set(a, "order", "desc")).toBe(false);
    expect(Reflect.set(a, "id", "other")).toBe(false);
    expect(() => { a.position.index = 2; }).toThrow();
});
it.each([0, -1, 1.5, NaN, Infinity, "1"])("rejects next(%j) before querying Firebase", async n => {
    await expect(database.cursor("records").next(n)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(fixture.sdk.once).not.toHaveBeenCalled();
});
it.each([null, [], 1])("rejects invalid options %j", options => {
    expect(() => database.cursor("records", options)).toThrow();
});
it.each([
    [{order: "sideways"}], [{orderBy: ""}], [{orderBy: 1}],
    [{equalTo: false, start: 0}], [{equalTo: 0, end: 1}], [{handle: true}],
])("rejects incompatible selection %j", options => {
    expect(() => database.cursor("records", options)).toThrow();
});
it("reads inclusive continuation boundaries without returning the boundary twice", async () => {
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1, b: 2})).mockResolvedValueOnce(fixture.snapshot({b: 2, c: 3}));
    const cursor = database.cursor("records");
    expect(await cursor.next(2)).toEqual([{key: "a", value: 1}, {key: "b", value: 2}]);
    expect(await cursor.next(2)).toEqual([{key: "c", value: 3}]);
    expect(cursor.position).toEqual({index: 2, key: "c", finished: true});expect(cursor.count).toBe(3);
    expect(fixture.sdk.once.mock.calls[1][0].query).toEqual({orderByKey: [], startAt: ["b"], limitToFirst: [3]});
    expect(await cursor.next()).toEqual([]);expect(fixture.sdk.once).toHaveBeenCalledTimes(2);
});
it("keeps all rows when a continuation boundary was deleted", async () => {
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1, b: 2})).mockResolvedValueOnce(fixture.snapshot({c: 3, d: 4, e: 5}));
    const cursor = database.cursor("records");await cursor.next(2);
    expect((await cursor.next(2)).map(entry => entry.key)).toEqual(["c", "d"]);
    expect((await cursor.next()).map(entry => entry.key)).toEqual(["e"]);
    expect(cursor.count).toBe(5);
});
it("uses field value and key for descending continuation", async () => {
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: {score: 5}, b: {score: 5}})).mockResolvedValueOnce(fixture.snapshot({a: {score: 5}}));
    const cursor = database.cursor("records", {orderBy: ["score"], order: "desc"});
    expect((await cursor.next(2)).map(entry => entry.key)).toEqual(["b", "a"]);
    expect(await cursor.next(2)).toEqual([]);
    expect(fixture.sdk.once.mock.calls[1][0].query).toEqual({orderByChild: ["score"], endAt: [5, "a"], limitToLast: [3]});
});
it.each([
    [{equalTo: false}, {orderByValue: [], equalTo: [false]}],
    [{orderBy: ["nested", "name"], start: "Al"}, {orderByChild: ["nested/name"], startAt: ["Al"], endAt: ["Al\uf8ff"]}],
    [{orderBy: "score", start: 0, end: 5}, {orderByChild: ["score"], startAt: [0], endAt: [5]}],
])("configures selection %j", async (options, expected) => {
    await database.cursor("records", options).next();
    const {limitToFirst, ...query} = fixture.sdk.once.mock.calls[0][0].query;
    expect(limitToFirst).toEqual([1]);expect(query).toEqual(expected);
});
it("applies date key bounds before handle even when ordering by a field", async () => {
    const startDate = new Date(1000), endDate = new Date(2000), inside = dateKey(1500, "min");
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({[dateKey(500, "min")]: {score: 1}, [inside]: {score: 2}, [dateKey(3000, "min")]: {score: 3}}));
    const handle = vi.fn();
    const cursor = database.cursor("records", {orderBy: "score", startDate, endDate, handle});
    expect(await cursor.next(10)).toEqual([{key: inside, value: {score: 2}}]);
    expect(handle).toHaveBeenCalledExactlyOnceWith({key: inside, value: {score: 2}});expect(cursor.count).toBe(1);
    await database.cursor("records", {startDate, endDate}).next();
    expect(fixture.sdk.once.mock.calls.at(-1)[0].query).toMatchObject({startAt: [dateKey(startDate, "min")], endAt: [dateKey(endDate, "max")]});
});
it("isolates handle mutations, awaits replacements, skips deletions and rereads saved values", async () => {
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: {n: 1}, b: {n: 2}, c: {n: 3}})).mockResolvedValueOnce(fixture.snapshot({n: 30, resolved: true}));
    const handle = vi.fn(async ({value, key}) => {
        if (key === "a") { value.n = 100; return undefined; }
        if (key === "b") return null;
        return {n: 30};
    });
    const cursor = database.cursor("records", {handle});
    expect(await cursor.next(10)).toEqual([{key: "a", value: {n: 1}}, {key: "c", value: {n: 30, resolved: true}}]);
    expect(handle.mock.calls.map(([{key}]) => key)).toEqual(["a", "b", "c"]);
    expect(fixture.sdk.set.mock.calls.map(([ref, value]) => [ref.key, value])).toEqual([["b", null], ["c", {n: 30}]]);
    expect(cursor.count).toBe(2);expect(cursor.position.index).toBe(1);
});
it.each([false, 0, ""])("writes falsy handle result %j", async value => {
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: {n: 1}})).mockResolvedValueOnce(fixture.snapshot(value));
    expect(await database.cursor("records", {handle: () => value}).next(2)).toEqual([{key: "a", value}]);
});
it("retries the failed candidate and counts only batches returned successfully", async () => {
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1, b: 2}));
    const error = new Error("retry"), onError = vi.fn();let fail = true;
    const cursor = database.cursor("records", {onError, handle: ({value, key}) => { if (key === "b" && fail) { fail = false; throw error; } }});
    expect(await cursor.next(3)).toBeUndefined();expect(cursor.count).toBe(0);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, "cursor.next", {path: "records", n: 3});
    expect(await cursor.next(3)).toEqual([{key: "b", value: 2}]);expect(cursor.count).toBe(1);
});
it("suppresses baseline events and updates count before delivering live notifications", async () => {
    const cursor = database.cursor("records"), events = [];
    const subscription = cursor.subscribe(event => events.push([event, cursor.count]));
    fixture.emit("child_added", 0, "initial");expect(events).toEqual([]);await flush();
    fixture.emit("child_added", {n: 1}, "a");fixture.emit("child_changed", {n: 2}, "a");fixture.emit("child_removed", {n: 2}, "a");
    expect(events).toEqual([
        [{type: "add", entry: {key: "a", value: {n: 1}}}, 1],
        [{type: "change", entry: {key: "a", value: {n: 2}}}, 1],
        [{type: "remove", entry: {key: "a", value: {n: 2}}}, 0],
    ]);
    expect(subscription).toMatchObject({id: cursor.id, subscribed: expect.any(Date), active: true, added: 1, changed: 1, removed: 1});
    expect(cursor.position.index).toBe(-1);subscription.unsubscribe();subscription.unsubscribe();
    expect(subscription.active).toBe(false);expect(fixture.sdk.listeners).toHaveLength(0);
});
it("counts independent deliveries and cleans up a failed composed subscription", async () => {
    const cursor = database.cursor("records"), a = cursor.subscribe(vi.fn()), b = cursor.subscribe(vi.fn());await flush();
    fixture.emit("child_added", 1);expect(cursor.count).toBe(2);a.unsubscribe();fixture.emit("child_removed", 1);expect(cursor.count).toBe(1);b.unsubscribe();
    const error = new Error("listen failed"), onError = vi.fn();let registered = 0;
    fixture.sdk.on.mockImplementation(() => { if (++registered === 4) throw error; });
    const composed = database.cursor([{path: "one"}, {path: "two"}], {onError});
    expect(composed.subscribe(vi.fn())).toBeUndefined();expect(fixture.sdk.listeners).toHaveLength(0);expect(onError).toHaveBeenCalledTimes(1);
});
it("inherits source options and deduplicates by normalized cursor path after handling", async () => {
    const sources = [], options = [];
    const create = (path, effective) => {
        options.push(effective);
        class Source extends DatabaseCursor {
            constructor() { super(effective, path); }
            async next(n) {
                await super.next(n);
                if (this.position.finished) return [];
                this._position = Object.freeze({index: 0, key: "a", finished: true});
                this._count++;
                return [{key: "a", value: path}];
            }
        }
        const source = new Source();sources.push(source);return source;
    };
    const cursor = composeCursor([{path: ["records"], order: "desc"}, {path: "records", orderBy: undefined}],
        {orderBy: "score", order: "asc"}, create, operation => operation());
    expect(options[0]).toMatchObject({orderBy: "score", order: "desc"});expect(options[1].orderBy).toBeUndefined();
    expect(await cursor.next(3)).toEqual([{key: "a", value: ["records"]}]);
    expect(cursor.count).toBe(1);expect(sources.map(source => source.count)).toEqual([1, 1]);expect(cursor.position.finished).toBe(true);
});
it("fills composition buffers once per source and consumes them without per-record reads", async () => {
    fixture.sdk.once.mockImplementation(ref => Promise.resolve(fixture.snapshot(ref.path === "one" ? {a: 1, c: 3, e: 5} : {b: 2, d: 4, f: 6})));
    const cursor = database.cursor([{path: "one"}, {path: "two"}]);
    expect((await cursor.next(3)).map(entry => entry.key)).toEqual(["a", "b", "c"]);
    expect(cursor.count).toBe(3);
    expect((await cursor.next(3)).map(entry => entry.key)).toEqual(["d", "e", "f"]);
    expect(cursor.count).toBe(6);expect(fixture.sdk.once).toHaveBeenCalledTimes(2);
    expect(fixture.sdk.once.mock.calls.map(([ref]) => ref.query.limitToFirst)).toEqual([[3], [3]]);
});
it("applies date bounds to subscriptions and reports callback/cancellation failures once", async () => {
    const onError = vi.fn(), callback = vi.fn(() => { throw new Error("callback"); });
    const cursor = database.cursor("records", {startDate: new Date(1000), endDate: new Date(2000), onError});
    const subscription = cursor.subscribe(callback);await flush();
    fixture.emit("child_added", 1, dateKey(500, "min"));expect(callback).not.toHaveBeenCalled();
    const inside = dateKey(1500, "min");fixture.emit("child_added", 2, inside);
    expect(callback).toHaveBeenCalledExactlyOnceWith({type: "add", entry: {key: inside, value: 2}});
    expect(cursor.count).toBe(1);
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({message: "callback"}), "cursor.subscribe", {path: "records"});
    const permission = new Error("permission");
    for (const {onError: cancel} of fixture.sdk.listeners) cancel(permission);
    expect(onError).toHaveBeenCalledTimes(2);
    subscription.unsubscribe();
});
it("retains staged source results across a suppressed composition failure", async () => {
    const onError = vi.fn();
    class Source extends DatabaseCursor {
        fail = false;
        async next(n) {
            await super.next(n);
            if (this.fail) { this.fail = false; throw new Error("second failed"); }
            if (this.position.finished) return [];
            this._position = Object.freeze({index: 0, key: "a", finished: true});
            this._count++;
            return [{key: "a", value: 1}];
        }
    }
    const first = new Source({}, "one"), second = new Source({}, "two");second.fail = true;
    const owner = new DatabaseBase({onError});
    const cursor = composeCursor([first, second], {onError}, vi.fn(), owner.run.bind(owner));
    expect(await cursor.next(2)).toBeUndefined();
    expect(first.count).toBe(1);expect(second.count).toBe(0);expect(cursor.count).toBe(0);expect(onError).toHaveBeenCalledTimes(1);
    expect(await cursor.next(2)).toEqual([{key: "a", value: 1}, {key: "a", value: 1}]);
    expect(cursor.count).toBe(2);
});
