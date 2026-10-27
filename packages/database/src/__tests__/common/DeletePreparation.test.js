import {getFunctions} from "firebase/functions";
import DatabaseBase from "../../common/DatabaseBase";
import FirebaseDatabase from "../../firebase";
import LocalDatabase from "../../local";

vi.mock("firebase/functions", () => ({
    getFunctions: vi.fn(() => { throw new Error("unexpected fallback"); }),
    httpsCallable: vi.fn()
}));

beforeEach(() => vi.clearAllMocks());
const path = ["posts", {post_id: "p1"}];
const address = provider => provider === "firebase" ? "posts/p1" : path;
const forProvider = (provider, backend, onError) => provider === "firebase"
    ? new FirebaseDatabase({firebase: {app: {}}, backend, onError})
    : new LocalDatabase({backend, onError});

describe.each(["local", "firebase"])("%s delete preparation", provider => {
    it("prepares its path and delegates deletion to the superclass using the constructor backend", async () => {
        const backend = {request: vi.fn().mockResolvedValue(null)};
        const database = forProvider(provider, backend);
        const superDelete = vi.spyOn(DatabaseBase.prototype, "delete");
        const open = vi.fn(() => { throw new Error("unexpected IndexedDB"); });
        vi.stubGlobal("indexedDB", {open});
        try {
            expect(await database.delete(path)).toBeUndefined();
            expect(superDelete).toHaveBeenCalledExactlyOnceWith(address(provider));
            expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.delete", address(provider));
            expect(path).toEqual(["posts", {post_id: "p1"}]);
            expect(open).not.toHaveBeenCalled();
            expect(getFunctions).not.toHaveBeenCalled();
        } finally { vi.unstubAllGlobals(); }
    });

    it("preserves original error context and the operation onError override", async () => {
        const failure = new Error("delete failed"), onError = vi.fn(), override = vi.fn();
        const backend = {request: vi.fn().mockRejectedValue(failure)};
        const database = forProvider(provider, backend, onError);
        expect(await database.delete(path, {onError: override})).toBeUndefined();
        expect(override).toHaveBeenCalledExactlyOnceWith(failure, "delete", {path});
        expect(onError).not.toHaveBeenCalled();
        expect(await database.delete(path)).toBeUndefined();
        expect(onError).toHaveBeenCalledExactlyOnceWith(failure, "delete", {path});
    });

    it.each(["preparation", "backend"])("handles a %s failure once even when onError throws", async phase => {
        const failure = new Error("delete failed"), handlerFailure = new Error("handler failed");
        const backend = {request: vi.fn().mockRejectedValue(failure)};
        const onError = vi.fn(() => { throw handlerFailure; });
        const target = phase === "preparation" ? [null] : path;
        await expect(forProvider(provider, backend).delete(target, {onError})).rejects.toBe(handlerFailure);
        expect(onError).toHaveBeenCalledExactlyOnceWith(phase === "backend" ? failure : expect.any(Error), "delete", {path: target});
        if (phase === "preparation") expect(backend.request).not.toHaveBeenCalled();
    });

    it("rejects invalid paths before requesting the backend", async () => {
        const backend = {request: vi.fn()}, database = forProvider(provider, backend);
        for (const target of [null, undefined, 1, {}, [null], ["posts", {}], ["posts", {post_id: 1}]]) {
            await expect(database.delete(target)).rejects.toMatchObject({code: "database/invalid-argument"});
        }
        expect(backend.request).not.toHaveBeenCalled();
    });

    it("propagates backend errors and requires an explicit backend without a fallback", async () => {
        const failure = new Error("delete failed");
        const backend = {request: vi.fn().mockRejectedValue(failure)};
        await expect(forProvider(provider, backend).delete(path)).rejects.toBe(failure);
        const open = vi.fn(() => { throw new Error("unexpected IndexedDB"); });
        vi.stubGlobal("indexedDB", {open});
        try {
            await expect(forProvider(provider).delete(path)).rejects.toBeInstanceOf(TypeError);
            expect(open).not.toHaveBeenCalled();
            expect(getFunctions).not.toHaveBeenCalled();
        } finally { vi.unstubAllGlobals(); }
    });

    it.each(["", []].map(path => ({path})))("keeps provider-specific root deletion rules for $path", async ({path}) => {
        const backend = {request: vi.fn().mockResolvedValue(null)};
        const database = forProvider(provider, backend);
        if (provider === "firebase") {
            expect(await database.delete(path)).toBeUndefined();
            expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.delete", "");
        } else {
            await expect(database.delete(path)).rejects.toMatchObject({code: "database/invalid-argument"});
            expect(backend.request).not.toHaveBeenCalled();
        }
    });
});

it("implements backend deletion and common validation directly in DatabaseBase", async () => {
    const backend = {request: vi.fn().mockResolvedValue(null)};
    const database = new DatabaseBase({backend});
    expect(await database.delete(path)).toBeUndefined();
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.delete", path);
    backend.request.mockClear();
    await expect(database.delete([null])).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(backend.request).not.toHaveBeenCalled();
});
