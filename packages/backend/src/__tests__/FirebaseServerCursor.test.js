import {vi} from "vitest";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import FirebaseServerCursor from "../firebase-server/src/FirebaseServerCursor";
import DatabaseCursor from "../../../database/src/common/DatabaseCursor";
import {key as dateKey} from "firebase-key";
import ComposedDatabaseCursor from "../../../database/src/common/ComposedDatabaseCursor";

vi.mock("firebase/database", () => { throw new Error("Server cursor must not import Client SDK."); });
const setup = () => {
    const records = new Map(), queries = [];
    const sdk = {once: vi.fn()};
    const snapshot = (key, value) => ({key, ref: reference(`records/${key}`), val: () => value,
        exists: () => value != null, child: field => snapshot(field, field.split("/").reduce((item, part) => item?.[part], value) ?? null)});
    const page = entries => ({forEach: callback => entries.forEach(([key, value]) => callback(snapshot(key, value)))});
    sdk.once.mockImplementation(async selection => selection.path === "records" ? page([])
        : snapshot(selection.path.split("/").at(-1), records.get(selection.path) ?? null));
    function reference(path = "", query = {}) {
        const selection = {path, query,
            once: event => sdk.once(selection, event), get: async () => ({val: () => records.get(path) ?? null}),
            // The backend conditional-write helper uses value listeners during transactions.
            on: (event, callback) => callback({val: () => records.get(path) ?? null}),
            off: vi.fn(),
            transaction: async callback => {
                const next = callback(records.get(path) ?? null);
                if (next !== undefined) records.set(path, next);
                return {committed: next !== undefined, snapshot: {val: () => records.get(path) ?? null}};
            },
        };
        for (const name of ["orderByKey", "orderByValue", "orderByChild", "equalTo", "startAt", "endAt", "limitToFirst", "limitToLast"]) {
            selection[name] = (...args) => { queries.push({name, args}); return reference(path, {...query, [name]: args}); };
        }
        return selection;
    }
    const database = {ref: vi.fn(reference)};
    const backend = new FirebaseServerBackend(() => database, undefined, {
        getMessagingInstance: () => { throw new Error("Cursor must not initialize Messaging."); },
    });
    return {backend, database, records, queries, sdk, page, snapshot};
};

it.each(["asc", "desc"])("returns the existing cursor and pages %s across equal sort values", async order => {
    const {backend, sdk, page, queries} = setup();
    const data = {rank: 1};
    sdk.once.mockResolvedValueOnce(page([["a", data], ["b", data]]))
        .mockResolvedValueOnce(page(order === "asc" ? [["b", data], ["c", data]] : [["0", data], ["a", data]]))
        .mockResolvedValueOnce(page([]));
    const cursor = await backend.request("database.cursor", ["records", "record_id"], {orderBy: "rank", order});
    expect(cursor).toBeInstanceOf(ComposedDatabaseCursor);
    expect((await cursor.next(2)).map(({key}) => key)).toEqual(order === "asc" ? ["a", "b"] : ["b", "a"]);
    expect((await cursor.next(1)).map(({key}) => key)).toEqual(order === "asc" ? ["c"] : ["0"]);
    expect(await cursor.next(1)).toEqual([]); expect(cursor.count).toBe(3); expect(cursor.position.finished).toBe(true);
    expect(queries).toContainEqual({name: "orderByChild", args: ["rank"]});
    expect(queries).toContainEqual({name: order === "asc" ? "startAt" : "endAt", args: [1, order === "asc" ? "b" : "a"]});
    expect(queries.some(({name}) => name === (order === "asc" ? "limitToFirst" : "limitToLast"))).toBe(true);
});
it("applies equality filters and returns an empty cursor", async () => {
    const {backend, queries} = setup();
    const cursor = await backend.request("database.cursor", "records", {orderBy: "to", equalTo: "parent"});
    expect(await cursor.next(10)).toEqual([]);
    expect(queries).toContainEqual({name: "equalTo", args: ["parent"]});
    expect(cursor.position.finished).toBe(true);
});
it.each([false, true])("persists handle replacement/deletion through the same backend (delete: %s)", async remove => {
    const {backend, sdk, page, records} = setup();
    records.set("records/a", {text: "before"});
    sdk.once.mockResolvedValueOnce(page([["a", {text: "before"}]]));
    const request = vi.spyOn(backend, "request");
    const cursor = await backend.request("database.cursor", "records", {handle: () => remove ? null : {text: "after"}});
    expect(await cursor.next(1)).toEqual(remove ? [] : [{key: "a", value: {text: "after"}}]);
    expect(records.get("records/a")).toEqual(remove ? null : {text: "after"});
    expect(request.mock.calls.filter(([name]) => name === "database.update")).toHaveLength(2);
    if (!remove) expect(sdk.once).toHaveBeenCalledWith(expect.objectContaining({path: "records/a"}), "value");
    else expect(sdk.once.mock.calls.every(([selection]) => selection.path === "records")).toBe(true);
});
it("propagates read failures even with onError", async () => {
    const {backend, sdk} = setup(); const error = new Error("read failed");
    sdk.once.mockRejectedValue(error);
    const cursor = await backend.request("database.cursor", "records");
    await expect(cursor.next(1)).rejects.toBe(error);
    const onError = vi.fn();
    const withHandler = await backend.request("database.cursor", "records", {onError});
    await expect(withHandler.next(1)).rejects.toBe(error);
    expect(onError).not.toHaveBeenCalled();
});
it.each([[], ["records", {}, true], [null], ["records", null], ["records", {order: "bad"}]])(
    "validates command arguments %j", async (...args) => {
        const {backend} = setup();
        await expect(backend.request("database.cursor", ...args)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
);

it("passes range endpoints to Admin queries", async () => {
    const {backend, queries} = setup();
    const cursor = await backend.request("database.cursor", "records", {orderBy: "rank", start: 2, end: 4});
    await cursor.next(3);
    expect(queries).toContainEqual({name: "startAt", args: [2]});
    expect(queries).toContainEqual({name: "endAt", args: [4]});
});

it("composes Admin query descriptions and fresh cursors with deduplication", async () => {
    const {backend, sdk, page, queries} = setup();
    const path = ["records", "record_id"];
    const first = await backend.request("database.cursor", path, {orderBy: "rank", equalTo: 1});
    const cursor = await backend.request("database.cursor", [first,
        {path, orderBy: "rank", equalTo: 2}]);
    sdk.once.mockResolvedValueOnce(page([["a", {rank: 1}], ["b", {rank: 1}]]))
        .mockResolvedValueOnce(page([["a", {rank: 1}], ["c", {rank: 2}]]));
    expect((await cursor.next(4)).map(row => row.key)).toEqual(["a", "b", "c"]);
    expect(cursor.position.finished).toBe(true);
    expect(queries).toContainEqual({name: "equalTo", args: [1]});
    expect(queries).toContainEqual({name: "equalTo", args: [2]});
    expect(first.path).toBe("records");
});

it("supports empty compositions and rejects invalid or reused sources", async () => {
    const {backend} = setup();
    // null is an ignored source, making this an unambiguous empty composition.
    const empty = await backend.request("database.cursor", [null]);
    expect(await empty.next(10)).toEqual([]);
    expect(empty.position.finished).toBe(true);
    const fresh = await backend.request("database.cursor", ["records", "record_id"]);
    for (const sources of [[Promise.resolve(fresh)], [fresh, fresh], [{path: null}]]) {
        await expect(backend.request("database.cursor", sources))
            .rejects.toMatchObject({code: "database/invalid-argument"});
    }
    await fresh.next(1);
    await expect(backend.request("database.cursor", [fresh]))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});
it("propagates composition validation errors even with onError", async () => {
    const {backend} = setup();
    const onError = vi.fn();
    await expect(backend.request("database.cursor", [{path: null}], {onError}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(onError).not.toHaveBeenCalled();
});

it("creates a DatabaseCursor subclass directly with readonly initial metadata", async () => {
    const {database, backend} = setup();
    const cursor = new FirebaseServerCursor(database, ["records", "record_id"], {}, backend);
    expect(cursor).toBeInstanceOf(DatabaseCursor);
    expect(cursor.path).toBe("records");
    expect(cursor.position).toEqual({index: -1, key: undefined, finished: false});
    for (const n of [0, -1, 1.5, NaN, Infinity]) {
        await expect(cursor.next(n)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
});
it("filters by date keys before invoking handle and leaves undefined replacements unchanged", async () => {
    const {backend, sdk, page} = setup();
    const before = dateKey(new Date(500), "min"), inside = dateKey(new Date(1500), "min");
    const after = dateKey(new Date(2500), "min");
    sdk.once.mockResolvedValueOnce(page([[before, {rank: 1}], [inside, {rank: 2}], [after, {rank: 3}]]));
    const handle = vi.fn(() => undefined), request = vi.spyOn(backend, "request");
    const cursor = await backend.request("database.cursor", "records", {
        orderBy: "rank", startDate: new Date(1000), endDate: new Date(2000), handle,
    });
    expect(await cursor.next(10)).toEqual([{key: inside, value: {rank: 2}}]);
    expect(handle).toHaveBeenCalledExactlyOnceWith({key: inside, value: {rank: 2}});
    expect(request.mock.calls.some(([name]) => name === "database.update")).toBe(false);
});
it("continues past object sort values without passing objects as Admin query bounds", async () => {
    const {backend, sdk, page, queries} = setup();
    sdk.once.mockResolvedValueOnce(page([["a", {n: 1}]]))
        .mockResolvedValueOnce(page([["a", {n: 1}], ["b", {n: 2}]]))
        .mockResolvedValueOnce(page([["a", {n: 1}], ["b", {n: 2}]]));
    const cursor = await backend.request("database.cursor", "records", {orderBy: ""});
    expect((await cursor.next(1)).map(row => row.key)).toEqual(["a"]);
    expect((await cursor.next(1)).map(row => row.key)).toEqual(["b"]);
    expect(await cursor.next(1)).toEqual([]);
    expect(queries.some(({name, args}) => ["startAt", "endAt"].includes(name) && typeof args[0] === "object")).toBe(false);
});
it("ignores missing ordered fields and retains a group heading", async () => {
    const {backend, sdk, page} = setup();
    sdk.once.mockResolvedValueOnce(page([["missing", {}], ["present", {nested: {rank: 2}}]]));
    const cursor = await backend.request("database.cursor", ["records", "record_id"], {
        orderBy: ["nested", "rank"], group: "heading",
    });
    expect(await cursor.next(10)).toEqual([{key: "heading"}, {key: "present", value: {nested: {rank: 2}}}]);
    expect(await cursor.next(10)).toEqual([]);
});
it("retries the same buffered record after a handle failure", async () => {
    const {backend, sdk, page} = setup();
    sdk.once.mockResolvedValueOnce(page([["a", 1]]));
    const error = new Error("handle failed"), onError = vi.fn();
    const handle = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const cursor = await backend.request("database.cursor", "records", {handle, onError});
    await expect(cursor.next(2)).rejects.toBe(error);
    expect(cursor.count).toBe(0);
    expect(onError).not.toHaveBeenCalled();
    expect(await cursor.next(2)).toEqual([{key: "a", value: 1}]);
});
