import {vi} from "vitest";
import FirebaseStorage from "../firebase";

let storage, sdk, ref, firebase;
beforeEach(() => {
    ref = {getDownloadURL: vi.fn().mockResolvedValue("https://files/file"), getMetadata: vi.fn().mockResolvedValue({fullPath: "user/file"}), delete: vi.fn().mockResolvedValue(undefined)};
    sdk = {ref: vi.fn(() => ref), refFromURL: vi.fn(() => ref)};
    firebase = {storage: Object.assign(() => sdk, {TaskEvent: {STATE_CHANGED: "state_changed"}})};
    storage = new FirebaseStorage({firebase});
});
it.each(["user/file", "gs://bucket/file", "https://files/file", "http://files/file"])("reads and deletes %s through the correct reference", async path => {
    expect(await storage.resolveDownloadURL(path)).toBe("https://files/file");
    expect(await storage.resolveMetadata(path)).toEqual({fullPath: "user/file"});
    expect(await storage.delete(path)).toBeUndefined();
    const expected = path === "user/file" ? sdk.ref : sdk.refFromURL;
    expect(expected).toHaveBeenCalledWith(path);
    expect(expected).toHaveBeenCalledTimes(3);
});
it("uploads through Auth and reports progress without exposing tasks", async () => {
    let progress, finish;
    const task = {snapshot: {ref}, on: vi.fn((event, onProgress, onError, onComplete) => { progress = onProgress; finish = onComplete; })};
    ref.put = vi.fn(() => task); ref.child = vi.fn(() => ref);
    const auth = {resolveCurrentUser: vi.fn().mockResolvedValue({id: "user"})};
    const blob = new File(["bytes"], "photo.png", {type: "image/png"});
    const onProgress = vi.fn();
    const pending = storage.upload({auth, blob, name: "preview", metadata: {custom: "value"}, onProgress});
    await vi.waitFor(() => expect(task.on).toHaveBeenCalled());
    expect(ref.child.mock.calls[0][0]).toMatch(/^user\/image\/preview-[\w-]+-photo\.png$/);
    expect(ref.put).toHaveBeenCalledWith(blob, {contentType: "image/png", customMetadata: {custom: "value", uid: "user", filename: "photo.png"}});
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
    ref.child = () => ref;
    ref.put = () => ({on: (event, progress, onError) => onError(error)});
    await expect(storage.upload({auth: "user", blob: new File(["x"], "x", {type: "text/plain"})})).rejects.toBe(error);
});
it("does not start an upload when Auth rejects", async () => {
    const error = new Error("Auth failed");
    const auth = {resolveCurrentUser: vi.fn().mockRejectedValue(error)};
    await expect(storage.upload({auth, blob: new File(["x"], "x")})).rejects.toBe(error);
    expect(sdk.ref).not.toHaveBeenCalled();
});
it.each(["getDownloadURL", "getMetadata"])("rejects when %s fails after upload completion", async method => {
    const error = new Error("post-upload failure");
    ref[method].mockRejectedValue(error);
    ref.child = vi.fn(() => ref);
    ref.put = vi.fn(() => ({snapshot: {ref}, on: (event, progress, onError, finish) => finish()}));
    await expect(storage.upload({auth: "user", blob: new File(["x"], "x")})).rejects.toBe(error);
    if (method === "getDownloadURL") expect(ref.getMetadata).not.toHaveBeenCalled();
});
