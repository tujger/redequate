import {IDBFactory} from "fake-indexeddb";
import * as pathValidation from "../../common/validatePath";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local";
import {validateCollectionPath, readValue, getChildRecordPath} from "../../local/helpers";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it.each(["delete", "update"])("validates the generic path once in the %s superclass pipeline", async method => {
    const validatePath = vi.spyOn(pathValidation, "default");
    const backend = {request: vi.fn().mockResolvedValueOnce({value: null, etag: "initial"})
        .mockResolvedValueOnce({committed: true, value: {text: "A"}})};
    const path = ["posts", {post_id: "p1"}];
    const database = new LocalDatabase({backend});
    if (method === "delete") await database.delete(path);
    else await database.update(path, {text: "A"});
    expect(validatePath).toHaveBeenCalledExactlyOnceWith(path);
});

it("validates only Local collection rules without invoking generic path validation", () => {
    const validatePath = vi.spyOn(pathValidation, "default");
    const path = [{collection: "posts"}, {post_id: "p1"}];
    expect(validateCollectionPath(path)).toEqual(["posts", {post_id: "p1"}]);
    expect(path[0]).toEqual({collection: "posts"});
    expect(validateCollectionPath("/posts//p1/")).toEqual(["posts", "p1"]);
    expect(validatePath).not.toHaveBeenCalled();
});

it("reports malformed inputs safely even before superclass validation", async () => {
    const backend = {request: vi.fn()}, database = new LocalDatabase({backend});
    const invalid = [null, undefined, 1, {}, [], [null], [1], [{collection: 1}], ["$auth"], [{collection: "a/b"}]];
    for (const path of invalid) {
        expect(() => validateCollectionPath(path)).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
        await expect(database.delete(path)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(backend.request).not.toHaveBeenCalled();
});

it("validates independent read, listener and cursor entrypoints before accessing IndexedDB", async () => {
    const database = new LocalDatabase({backend: {request: vi.fn()}});
    const path = ["posts", {post_id: "p1"}, {}];
    const open = vi.spyOn(globalThis.indexedDB, "open");
    await expect(database.read(path)).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(database.readSubtree(path)).rejects.toMatchObject({code: "database/invalid-argument"});
    const onError = vi.fn();
    const listener = database.addEventListener(path, {onError});
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({code: "database/invalid-argument"}), "addEventListener", {path, orderBy: undefined});
    expect(listener).toBeUndefined();
    expect(() => database.cursor(path)).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    expect(open).not.toHaveBeenCalled();
});

it("validates independent storage helper arguments without opening a transaction", async () => {
    const context = {storageId: "path-validation"}, path = ["posts", {}];
    const open = vi.spyOn(globalThis.indexedDB, "open");
    expect(() => readValue(context, path)).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    expect(() => getChildRecordPath(context, path, "child")).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    expect(open).not.toHaveBeenCalled();
});

it("validates direct backend-delete and root batch-update paths before opening storage", async () => {
    const backend = new LocalBackend({storageId: "path-validation"});
    const open = vi.spyOn(globalThis.indexedDB, "open");
    const path = ["posts", {post_id: "p1"}, {}];
    await expect(backend.request("database.delete", path)).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(backend.request("database.update", "", new Map([[path, null]])))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(open).not.toHaveBeenCalled();
});
