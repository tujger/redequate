import {vi} from "vitest";
import FirebaseStorage from "../firebase";
import * as modularStorage from "firebase/storage";
vi.mock("firebase/storage", () => ({
    getStorage: vi.fn(app => app),
    ref: vi.fn(),
    getDownloadURL: vi.fn(),
    getMetadata: vi.fn(),
    deleteObject: vi.fn(),
    uploadBytesResumable: vi.fn(),
}));

let storage, sdk, ref, firebase;
beforeEach(() => {
    ref = {getDownloadURL: vi.fn().mockResolvedValue("https://files/file"), getMetadata: vi.fn().mockResolvedValue({fullPath: "user/file"}), delete: vi.fn().mockResolvedValue(undefined)};
    sdk = {};
    vi.clearAllMocks();
    modularStorage.ref.mockImplementation(() => ref);
    modularStorage.getDownloadURL.mockImplementation(reference => reference.getDownloadURL());
    modularStorage.getMetadata.mockImplementation(reference => reference.getMetadata());
    modularStorage.deleteObject.mockImplementation(reference => reference.delete());
    modularStorage.uploadBytesResumable.mockImplementation((reference, ...args) => reference.put(...args));
    firebase = {app: sdk};
    storage = new FirebaseStorage({firebase});
});
it.each(["user/file", "gs://bucket/file", "https://files/file", "http://files/file"])("reads and deletes %s through the correct reference", async path => {
    expect(await storage.resolveDownloadURL(path)).toBe("https://files/file");
    expect(await storage.resolveMetadata(path)).toEqual({fullPath: "user/file"});
    expect(await storage.delete(path)).toBeUndefined();
    const expected = modularStorage.ref;
    expect(expected).toHaveBeenCalledWith(sdk, path);
    expect(expected).toHaveBeenCalledTimes(3);
});
it("uploads through Auth and reports progress without exposing tasks", async () => {
    let progress, finish;
    const task = {snapshot: {ref}, on: vi.fn((event, onProgress, onError, onComplete) => { progress = onProgress; finish = onComplete; })};
    ref.put = vi.fn(() => task);
    const auth = {resolveCurrentUser: vi.fn().mockResolvedValue({id: "user"})};
    const blob = new File(["bytes"], "photo.png", {type: "image/png"});
    const onProgress = vi.fn();
    const pending = storage.upload({auth, blob, name: "preview", metadata: {custom: "value"}, onProgress});
    await vi.waitFor(() => expect(task.on).toHaveBeenCalled());
    expect(modularStorage.ref.mock.calls[0][1]).toMatch(/^user\/image\/preview-[\w-]+-photo\.png$/);
    expect(modularStorage.uploadBytesResumable).toHaveBeenCalledWith(ref, blob, {contentType: "image/png", customMetadata: {custom: "value", uid: "user", filename: "photo.png"}});
    progress({bytesTransferred: 1, totalBytes: 3});
    expect(onProgress).toHaveBeenCalledWith("33");
    finish();
    expect(await pending).toEqual({url: "https://files/file", metadata: {fullPath: "user/file"}});
});
it("passes upload and reference failures through unchanged", async () => {
    const error = new Error("SDK error");
    for (const name of ["getDownloadURL", "getMetadata", "delete"]) ref[name].mockRejectedValue(error);
    await expect(storage.resolveDownloadURL("path")).rejects.toBe(error);
    await expect(storage.resolveMetadata("path")).rejects.toBe(error);
    await expect(storage.delete("path")).rejects.toBe(error);
    ref.put = () => ({on: (event, progress, onError) => onError(error)});
    await expect(storage.upload({auth: "user", blob: new File(["x"], "x", {type: "text/plain"})})).rejects.toBe(error);
});
it("does not start an upload when Auth rejects", async () => {
    const error = new Error("Auth failed");
    const auth = {resolveCurrentUser: vi.fn().mockRejectedValue(error)};
    await expect(storage.upload({auth, blob: new File(["x"], "x")})).rejects.toBe(error);
    expect(modularStorage.ref).not.toHaveBeenCalled();
});
it.each(["getDownloadURL", "getMetadata"])("rejects when %s fails after upload completion", async method => {
    const error = new Error("post-upload failure");
    ref[method].mockRejectedValue(error);

    ref.put = vi.fn(() => ({snapshot: {ref}, on: (event, progress, onError, finish) => finish()}));
    await expect(storage.upload({auth: "user", blob: new File(["x"], "x")})).rejects.toBe(error);
    if (method === "getDownloadURL") expect(ref.getMetadata).not.toHaveBeenCalled();
});
