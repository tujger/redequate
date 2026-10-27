import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import createLocalDatabase from "../createLocalDatabase";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const path = ["posts", {post_id: "p1"}];

it.each([path, [...path, "text"], ["posts"], "posts/p1"].map(path => ({path})))(
    "forwards $path to its supplied backend without accessing IndexedDB", async ({path: target}) => {
        const backend = {request: vi.fn().mockResolvedValue(null)};
        const open = vi.spyOn(globalThis.indexedDB, "open");
        const database = new LocalDatabase({backend});
        expect(await database.delete(target)).toBeUndefined();
        expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.delete", target);
        expect(open).not.toHaveBeenCalled();
    }
);

it("uses the configured operation error handler once with the original path", async () => {
    const failure = new Error("delete failed"), onError = vi.fn(), override = vi.fn();
    const backend = {request: vi.fn().mockRejectedValue(failure)};
    const database = new LocalDatabase({backend, onError});
    expect(await database.delete(path)).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure, "delete", {path});
    expect(await database.delete(path, {onError: override})).toBeUndefined();
    expect(override).toHaveBeenCalledExactlyOnceWith(failure, "delete", {path});
    expect(onError).toHaveBeenCalledTimes(1);
});

it("propagates backend errors and does not handle an error-handler failure twice", async () => {
    const failure = new Error("delete failed"), handlerFailure = new Error("handler failed");
    const backend = {request: vi.fn().mockRejectedValue(failure)};
    const database = new LocalDatabase({backend});
    await expect(database.delete(path)).rejects.toBe(failure);
    const onError = vi.fn(() => { throw handlerFailure; });
    await expect(database.delete(path, {onError})).rejects.toBe(handlerFailure);
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure, "delete", {path});
});

it("rejects invalid paths before requesting the backend and reports validation errors once", async () => {
    const backend = {request: vi.fn()}, database = new LocalDatabase({backend});
    for (const target of [null, undefined, "", [], ["$auth"], ["posts", {}], ["posts", {post_id: 1}]]) {
        await expect(database.delete(target)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    const onError = vi.fn();
    expect(await database.delete([], {onError})).toBeUndefined();
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "database/invalid-argument"}), "delete", {path: []});
    expect(backend.request).not.toHaveBeenCalled();
});

it("requires the supplied backend without opening IndexedDB as a fallback", async () => {
    const open = vi.spyOn(globalThis.indexedDB, "open");
    await expect(new LocalDatabase().delete(path)).rejects.toBeInstanceOf(TypeError);
    expect(open).not.toHaveBeenCalled();
});

it("requires separately prepared stores and delegates deletion and notifications to LocalBackend", async () => {
    const database = createLocalDatabase({storageId: "delegated-delete"});
    await expect(database.delete(path)).rejects.toMatchObject({name: "NotFoundError"});
    await database.read(["posts"]);
    await database.create(path, {text: "A"});
    const onChange = vi.fn(), onChildRemove = vi.fn();
    const listener = database.addEventListener(["posts"], {onChange, onChildRemove});
    try {
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        expect(await database.delete(path)).toBeUndefined();
        expect(await database.read(path)).toBeUndefined();
        expect(onChildRemove).toHaveBeenCalledExactlyOnceWith({key: "p1", value: {text: "A"}});
        expect(onChange).toHaveBeenCalledTimes(2);
    } finally { listener.remove(); }
});
