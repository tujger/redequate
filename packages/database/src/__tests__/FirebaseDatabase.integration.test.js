import {vi} from "vitest";
import {key as dateKey} from "firebase-key";
import {database, firebase} from "../../../../src/__tests__/common";

const path = "database_test";
const subscriptions = [];
afterEach(() => {
    for (const subscription of subscriptions.splice(0)) {
        if (subscription.unsubscribe) subscription.unsubscribe();
        else subscription.remove();
    }
});
const seed = value => firebase.database().ref(path).set(value);
async function readAll(cursor, size = 10) {
    const entries = [];
    while (!cursor.position.finished) {
        const batch = await cursor.next(size);
        expect(batch).toBeInstanceOf(Array);
        entries.push(...batch);
        if (entries.length > 1000) throw new Error("Cursor did not finish");
    }
    return entries;
}
async function subscribe(cursor, listener) {
    const subscription = cursor.subscribe(listener);
    subscriptions.push(subscription);
    // A value event is queued after the baseline child events on the same query.
    await firebase.database().ref(path).once("value");
    await Promise.resolve();
    return subscription;
}

it("reads/writes/deletes real nodes and applies partial and mu ltipath updates", async () => {
    await database.write([path, "record"], {name: "A", retained: true});
    await database.update([path, "record"], {name: "B"});
    expect(await database.read([path, "record"])).toEqual({name: "B", retained: true});
    await database.update({[`${path}/record/name`]: "C", [`${path}/other`]: 0});
    await database.update(new Map([[[path, "record", "retained"], null], [[path, "created", "enabled"], false]]));
    expect(await database.read(path)).toEqual({record: {name: "C"}, other: 0, created: {enabled: false}});
    await database.delete([path, "record"]);await database.delete([path, "record"]);
    expect(await database.read([path, "record"])).toBeUndefined();
});
it("creates through a transaction and never overwrites an existing generated record", async () => {
    const draft = database.create([path]);
    expect(await database.read([path, draft.temporaryKey])).toBeUndefined();
    expect(await draft.save({name: "created"})).toBe(draft.temporaryKey);
    await expect(draft.save({name: "overwritten"})).rejects.toMatchObject({code: "database/already-exists"});
    expect(await database.read([path, draft.temporaryKey])).toEqual({name: "created"});
    const retry = database.create(path);
    await expect(retry.save(undefined)).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await retry.save({timestamp: database.TIMESTAMP, count: database.increment(2)})).toBe(retry.temporaryKey);
    expect(await database.read([path, retry.temporaryKey])).toMatchObject({timestamp: expect.any(Number), count: 2});
});
it.each(["asc", "desc"])("reads all 83 equal-valued records in %s pages", async order => {
    const values = Object.fromEntries(Array.from({length: 83}, (_, index) => [`key-${String(index).padStart(3, "0")}`, {type: "Join us", index}]));
    await seed({...values, unrelated: {type: "Other", index: 100}});
    const cursor = database.cursor(path, {orderBy: "type", equalTo: "Join us", order});
    const entries = await readAll(cursor);
    const keys = Object.keys(values);if (order === "desc") keys.reverse();
    expect(entries.map(entry => entry.key)).toEqual(keys);
    expect(new Set(entries.map(entry => entry.key)).size).toBe(83);
    expect(cursor.count).toBe(83);expect(cursor.position.index).toBe(82);
});
it.each(["asc", "desc"])("continues correctly after the %s boundary record is deleted", async order => {
    await seed({a: {type: "same"}, b: {type: "same"}, c: {type: "same"}, d: {type: "same"}, e: {type: "same"}});
    const cursor = database.cursor(path, {orderBy: "type", equalTo: "same", order});
    const first = await cursor.next(2);
    await database.delete([path, first.at(-1).key]);
    const rest = await readAll(cursor, 2);
    expect([...first, ...rest].map(entry => entry.key)).toEqual(order === "asc" ? ["a", "b", "c", "d", "e"] : ["e", "d", "c", "b", "a"]);
});
it("uses prefix, explicit numeric bounds, nested ordering and value equality", async () => {
    await seed({a: {nested: {name: "Alice"}, score: 0}, b: {nested: {name: "Alina"}, score: 1}, c: {nested: {name: "Bob"}, score: 2}});
    expect((await readAll(database.cursor(path, {orderBy: ["nested", "name"], start: "Al"}))).map(entry => entry.key)).toEqual(["a", "b"]);
    expect((await readAll(database.cursor(path, {orderBy: "score", start: 0, end: 1}))).map(entry => entry.key)).toEqual(["a", "b"]);
    await seed({a: false, b: true, c: false});
    expect(await readAll(database.cursor(path, {equalTo: false}))).toEqual([{key: "a", value: false}, {key: "c", value: false}]);
});
it("combines date key bounds with ordering by a different field", async () => {
    const before = dateKey(1000, "min"), first = dateKey(2000, "min"), second = dateKey(3000, "max"), after = dateKey(4000, "max");
    await seed({[before]: {score: 0}, [first]: {score: 2}, [second]: {score: 1}, [after]: {score: 3}});
    const options = {startDate: new Date(2000), endDate: new Date(3000)};
    expect((await readAll(database.cursor(path, options))).map(entry => entry.key)).toEqual([first, second]);
    expect((await readAll(database.cursor(path, {...options, orderBy: "score"}), 1)).map(entry => entry.key)).toEqual([second, first]);
});
it("isolates handler mutations, deletes, replaces and resolves server timestamp values", async () => {
    await seed({a: {n: 1}, b: {n: 2}, c: {n: 3}});
    const cursor = database.cursor(path, {handle: async ({key, value}) => {
        if (key === "a") { value.n = 100; return undefined; }
        if (key === "b") return null;
        return {n: 30, timestamp: database.TIMESTAMP};
    }});
    expect(await readAll(cursor, 2)).toEqual([{key: "a", value: {n: 1}}, {key: "c", value: {n: 30, timestamp: expect.any(Number)}}]);
    expect(await database.read([path, "a"])).toEqual({n: 1});expect(await database.read([path, "b"])).toBeUndefined();expect(cursor.count).toBe(2);
});
it("merges overlapping cursors without duplicate records or repeated handle calls", async () => {
    await seed({a: {score: 1}, b: {score: 2}, c: {score: 3}});const handle = vi.fn();
    const cursor = database.cursor([{path, start: 1, end: 2}, {path, start: 2, end: 3}], {orderBy: "score", handle});
    const entries = await readAll(cursor, 2);
    expect(entries.map(entry => entry.key).sort()).toEqual(["a", "b", "c"]);expect(cursor.count).toBe(3);expect(handle).toHaveBeenCalledTimes(3);
});
it("delivers subscription changes after the baseline and updates count before callbacks", async () => {
    await seed({a: {score: 1}});const cursor = database.cursor(path), events = [];
    await cursor.next(10);
    const subscription = await subscribe(cursor, event => events.push({...event, count: cursor.count}));
    expect(events).toEqual([]);
    await database.write([path, "b"], {score: 2});
    await vi.waitFor(() => expect(events).toHaveLength(1));
    await database.update([path, "b"], {score: 3});
    await vi.waitFor(() => expect(events).toHaveLength(2));
    await database.delete([path, "a"]);
    await vi.waitFor(() => expect(events).toHaveLength(3));
    expect(events).toEqual([
        {type: "add", entry: {key: "b", value: {score: 2}}, count: 2},
        {type: "change", entry: {key: "b", value: {score: 3}}, count: 2},
        {type: "remove", entry: {key: "a", value: {score: 1}}, count: 1},
    ]);
    expect(subscription).toMatchObject({active: true, added: 1, changed: 1, removed: 1, subscribed: expect.any(Date)});
    subscription.unsubscribe();await database.write([path, "c"], {score: 4});
    expect(events).toHaveLength(3);expect(subscription.active).toBe(false);
});
it("normalizes listener events and stops them on remove", async () => {
    const onChange = vi.fn(), onChildAdd = vi.fn(), onChildChange = vi.fn(), onChildRemove = vi.fn();
    const listener = database.addEventListener(path, {onChange, onChildAdd, onChildChange, onChildRemove});subscriptions.push(listener);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
    await database.write([path, "a"], {n: 1});await vi.waitFor(() => expect(onChildAdd).toHaveBeenCalledWith({key: "a", value: {n: 1}}));
    await database.update([path, "a"], {n: 2});await vi.waitFor(() => expect(onChildChange).toHaveBeenCalledWith({key: "a", value: {n: 2}}));
    await database.delete([path, "a"]);await vi.waitFor(() => expect(onChildRemove).toHaveBeenCalledWith({key: "a", value: {n: 2}}));
    listener.remove();const calls = onChange.mock.calls.length;await database.write([path, "b"], 3);expect(onChange).toHaveBeenCalledTimes(calls);
});
it("passes permission errors to onError with operation context", async () => {
    const onError = vi.fn();
    await expect(database.read("database_denied", {onError})).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "PERMISSION_DENIED"}), "read", {path: "database_denied", equalTo: undefined, orderBy: undefined});
});
