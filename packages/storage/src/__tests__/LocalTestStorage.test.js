import {vi} from "vitest";
import {IDBFactory, IDBDatabase, IDBObjectStore} from "fake-indexeddb";
import LocalTestStorage from "../local-test";

let storage, auth;
const clone = globalThis.structuredClone;
beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("structuredClone", clone);
    vi.spyOn(Math, "random").mockReturnValue(0);
    storage = new LocalTestStorage();
    auth = {resolveCurrentUser: vi.fn().mockResolvedValue({id: "user"})};
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const upload = options => storage.upload({auth, blob: new File(["hello"], "file.txt", {type: "text/plain"}), ...options});
it("persists files across instances and resolves both path and URL", async () => {
    const onProgress = vi.fn();
    const result = await upload({name: "preview", metadata: {note: "test"}, onProgress});
    expect(result.url).toMatch(/^data:text\/plain;base64,aGVsbG8=#/);
    expect(result.metadata).toMatchObject({contentType: "text/plain", size: 5, customMetadata: {note: "test", uid: "user", filename: "file.txt"}});
    expect(onProgress.mock.calls).toEqual([["0"], ["100"]]);
    storage = new LocalTestStorage();
    expect(await storage.resolveDownloadURL(result.metadata.fullPath)).toBe(result.url);
    expect(await storage.resolveMetadata(result.url)).toEqual(result.metadata);
    const detached = await storage.resolveMetadata(result.url);
    detached.customMetadata.note = "changed";
    expect((await storage.resolveMetadata(result.url)).customMetadata.note).toBe("test");
    await storage.delete(result.url);
    await expect(storage.resolveMetadata(result.metadata.fullPath)).rejects.toMatchObject({code: "storage/object-not-found"});
    expect(result.url).toContain("aGVsbG8=");
});
it("keeps identical files independent and namespaces isolated", async () => {
    const first = await upload();
    const second = await upload();
    expect(first.url).not.toBe(second.url);
    expect(first.metadata.fullPath).not.toBe(second.metadata.fullPath);
    const other = new LocalTestStorage({storageKey: "other"});
    await expect(other.resolveMetadata(first.url)).rejects.toMatchObject({code: "storage/object-not-found"});
    await storage.delete(first.metadata.fullPath);
    expect(await storage.resolveDownloadURL(second.url)).toBe(second.url);
});
it("validates arguments and requires an authenticated user", async () => {
    for (const key of [null, "", " ", 1]) expect(() => new LocalTestStorage({storageKey: key})).toThrow("storageKey");
    for (const options of [{auth: null}, {blob: {}}, {metadata: []}, {name: 3}, {onProgress: "bad"}]) {
        await expect(upload(options)).rejects.toMatchObject({code: "storage/invalid-argument"});
    }
    auth.resolveCurrentUser.mockResolvedValue(null);
    await expect(upload()).rejects.toMatchObject({code: "storage/unauthenticated"});
    for (const path of [null, "", " ", 123]) await expect(storage.resolveMetadata(path)).rejects.toMatchObject({code: "storage/invalid-argument"});
});
it("passes Auth and IndexedDB errors through and reports no success on abort", async () => {
    const error = new Error("Auth failed");
    auth.resolveCurrentUser.mockRejectedValue(error);
    await expect(upload()).rejects.toBe(error);
    auth.resolveCurrentUser.mockResolvedValue({id: "user"});
    vi.spyOn(window.indexedDB, "open").mockImplementation(() => { throw error; });
    await expect(upload()).rejects.toBe(error);
    vi.restoreAllMocks(); vi.spyOn(Math, "random").mockReturnValue(0);
    const onProgress = vi.fn();
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (value) {
        const request = add.call(this, value);
        this.transaction.abort();
        return request;
    });
    await expect(upload({onProgress})).rejects.toThrow();
    expect(onProgress.mock.calls).toEqual([["0"]]);
});
it("does not finish upload before transaction commit", async () => {
    const events = [];
    const transaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (...args) {
        const result = transaction.apply(this, args);
        result.addEventListener("complete", () => events.push("commit"));
        return result;
    });
    await upload({onProgress: value => { if (value === "100") events.push("progress"); }});
    events.push("resolved");
    expect(events.slice(-3)).toEqual(["commit", "progress", "resolved"]);
});

it("passes FileReader errors through without persisting a file", async () => {
    const error = new Error("FileReader failed");
    const read = vi.spyOn(window.FileReader.prototype, "readAsDataURL").mockImplementation(function () {
        Object.defineProperty(this, "error", {value: error, configurable: true});
        this.onerror();
    });
    const open = vi.spyOn(window.indexedDB, "open");
    await expect(upload()).rejects.toBe(error);
    expect(open).not.toHaveBeenCalled();
    read.mockImplementation(function () { this.onabort(); });
    await expect(upload()).rejects.toThrow("LocalTestStorage file reading aborted.");
    expect(open).not.toHaveBeenCalled();
});
it("stores unnamed untyped Blobs and detaches supplied metadata", async () => {
    const metadata = {nested: {value: "original"}, uid: "spoofed", filename: "spoofed"};
    const result = await upload({blob: new Blob(["bytes"]), metadata});
    expect(result.metadata).toMatchObject({contentType: "application/octet-stream", size: 5, customMetadata: {uid: "user", filename: "file", nested: {value: "original"}}});
    expect(result.metadata.fullPath).toMatch(/^user\/application\/.+-file$/);
    expect(result.url).toMatch(/^data:application\/octet-stream;base64,/);
    metadata.nested.value = "changed input";
    result.metadata.customMetadata.nested.value = "changed result";
    expect((await storage.resolveMetadata(result.url)).customMetadata.nested.value).toBe("original");
    expect(metadata.uid).toBe("spoofed");
});
it("rejects blocked IndexedDB upgrades and closes a late connection", async () => {
    const request = {};
    const close = vi.fn();
    vi.spyOn(window.indexedDB, "open").mockReturnValue(request);
    const onProgress = vi.fn();
    const pending = upload({onProgress});
    const rejected = expect(pending).rejects.toThrow("LocalTestStorage database upgrade is blocked.");
    await vi.waitFor(() => expect(request.onblocked).toBeTypeOf("function"));
    request.onblocked();
    await rejected;
    expect(onProgress.mock.calls).toEqual([["0"]]);
    request.result = {close};
    request.onsuccess();
    expect(close).toHaveBeenCalledOnce();
});
