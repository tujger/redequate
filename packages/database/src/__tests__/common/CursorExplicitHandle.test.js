import createService from "../../../../../src/__tests__/createService";
import {singletonMetaStore} from "../../../../../src/__tests__/createService";
import {IDBFactory} from "fake-indexeddb";
import FirebaseDatabase from "../../firebase";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local/LocalBackend";
import FilteringDatabaseCursor from "../../common/FilteringDatabaseCursor";
import {createFirebase} from "../fixtures/firebase";

vi.mock("../../../../backend/src/common", () => ({handlers: {}}));
vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));

const initial = {post_id: "a", n: 1};
let nextId = 0;
afterEach(() => vi.unstubAllGlobals());

async function setup(provider) {
    let database, backend, path;
    if (provider === "local") {
        vi.stubGlobal("indexedDB", new IDBFactory());
        const storageId = `cursor-handle-${++nextId}`;
        backend = new LocalBackend({storageId});
        database = createService(LocalDatabase, {stores: [singletonMetaStore], storageId, backend});
        await database.read(["posts"]);
        await database.create(["posts", {post_id: "a"}], initial);
        path = ["posts", "post_id"];
    } else {
        const fixture = createFirebase();
        const records = {a: structuredClone(initial)};
        backend = {request: vi.fn(async (name, address, value, options) => {
            expect(name).toBe("database.update");
            expect(address).toBe("posts/a");
            if (options.mode === "read") return {value: records.a ?? null, etag: "initial"};
            expect(options.mode).toBe("replace");
            if (value === null) delete records.a;
            else records.a = structuredClone(value);
            return {committed: true, value};
        })};
        fixture.sdk.once.mockImplementation(async reference => reference.path === "posts"
            ? fixture.snapshot(records, undefined, "posts")
            : fixture.snapshot(records.a, "a", "posts"));
        database = createService(FirebaseDatabase, {firebase: fixture.firebase, backend});
        path = "posts";
    }
    return {database, path, request: vi.spyOn(backend, "request")};
}

function wrap(database, path, options, kind = "plain") {
    const cursor = database.cursor(path, options);
    if (kind === "filtered") return new FilteringDatabaseCursor(cursor, () => true);
    if (kind === "nested") return database.cursor([database.cursor([cursor])]);
    return cursor;
}

for (const provider of ["firebase", "local"]) describe(provider, () => {
    for (const mode of ["options", "argument"]) {
        it.each([undefined, null, {post_id: "a", n: 2}, 0, false, ""])(
            `applies ${mode} handle result %j consistently`, async replacement => {
                const {database, path, request} = await setup(provider);
                const handle = vi.fn(async entry => {
                    entry.value.n = 99;
                    await Promise.resolve();
                    return replacement;
                });
                const storedHandle = vi.fn();
                const cursor = database.cursor(path, {handle: mode === "options" ? handle : storedHandle});
                const entries = mode === "options" ? await cursor.next(10) : await cursor.next(10, handle);
                const expected = replacement === undefined ? initial : replacement;
                expect(entries).toEqual(replacement === null ? [] : [{key: "a", value: expected}]);
                expect(handle).toHaveBeenCalledExactlyOnceWith({key: "a", value: {...initial, n: 99}});
                expect(storedHandle).not.toHaveBeenCalled();
                const writes = request.mock.calls.filter(([name, , , options]) =>
                    name === "database.update" && options?.mode === "replace");
                expect(writes).toHaveLength(replacement === undefined ? 0 : 1);
                expect(await database.cursor(path).next(10)).toEqual(entries);
            }
        );
    }

    for (const kind of ["plain", "filtered", "nested"]) {
        it.each(["omitted", "undefined", "null", "function"])(
            `selects the handle through ${kind} cursors (%s)`, async argument => {
                const {database, path, request} = await setup(provider);
                const storedHandle = vi.fn(() => ({...initial, n: 2}));
                const explicit = vi.fn(() => ({...initial, n: 3}));
                const cursor = wrap(database, path, {handle: storedHandle}, kind);
                const args = argument === "omitted" ? [10]
                    : [10, {undefined: undefined, null: null, function: explicit}[argument]];
                const n = argument === "null" ? 1 : argument === "function" ? 3 : 2;
                expect(await cursor.next(...args)).toEqual([{key: "a", value: {...initial, n}}]);
                expect(storedHandle).toHaveBeenCalledTimes(["omitted", "undefined"].includes(argument) ? 1 : 0);
                expect(explicit).toHaveBeenCalledTimes(argument === "function" ? 1 : 0);
                expect(request.mock.calls.filter(([name, , , options]) =>
                    name === "database.update" && options?.mode === "replace"))
                    .toHaveLength(argument === "null" ? 0 : 1);
            }
        );
    }

    it("retains source-specific handles when undefined is forwarded", async () => {
        const {database, path} = await setup(provider);
        const outer = vi.fn();
        const inner = vi.fn();
        await database.cursor([{path, handle: inner}], {handle: outer}).next(10, undefined);
        expect(inner).toHaveBeenCalledTimes(1);
        expect(outer).not.toHaveBeenCalled();
    });

    it.each(["throw", "reject"])("propagates an explicit handle %s without writing", async mode => {
        const {database, path, request} = await setup(provider);
        const failure = new Error("stop");
        const handle = () => {
            if (mode === "throw") throw failure;
            return Promise.reject(failure);
        };
        await expect(wrap(database, path, {}, "filtered").next(10, handle)).rejects.toBe(failure);
        expect(request).not.toHaveBeenCalled();
    });

    it.each([false, 0, "invalid", {}])("rejects an invalid next handle %j", async handle => {
        const {database, path} = await setup(provider);
        await expect(database.cursor(path).next(10, handle)).rejects.toMatchObject({code: "database/invalid-argument"});
    });
});
