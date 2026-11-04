import BackendBase from "../common/BackendBase";
import LocalBackend from "../local/LocalBackend";
import DatabaseBase from "../../../database/src/common/DatabaseBase";
import AuthBase from "../../../auth/src/AuthBase";
import FirebaseBackendClient from "../firebase-client/FirebaseBackendClient";
import TagListener from "../common/handlers/tag";

vi.mock("firebase/functions", () => ({getFunctions: () => ({}), httpsCallable: vi.fn()}));

it("links independently constructed providers and uses replacement dependencies", async () => {
    const backend = new BackendBase();
    const database = new DatabaseBase();
    const auth = new AuthBase();
    const storage = {delete: vi.fn()};
    backend.setAuth(auth);
    backend.setDatabase(database);
    backend.setStorage(storage);
    database.setAuth(auth);
    database.setBackend(backend);
    auth.setDatabase(database);
    expect(backend._auth).toBe(auth);
    expect(backend._database).toBe(database);
    expect(database._auth).toBe(auth);
    expect(auth._database).toBe(database);
    expect(database._backend).toBe(backend);
    await backend.storage.delete("old");
    expect(storage.delete).toHaveBeenCalledWith("old");
    const replacement = {delete: vi.fn()};
    backend.setStorage(replacement);
    await backend.storage.delete("new");
    expect(replacement.delete).toHaveBeenCalledWith("new");
    const otherBackend = new BackendBase();
    database.setBackend(otherBackend);
    const otherDatabase = new DatabaseBase();
    backend.setDatabase(otherDatabase);
    auth.setDatabase(otherDatabase);
    const otherAuth = new AuthBase();
    database.setAuth(otherAuth);
    expect(database._backend).toBe(otherBackend);
    expect(backend._database).toBe(otherDatabase);
    expect(auth._database).toBe(otherDatabase);
    expect(database._auth).toBe(otherAuth);
});

it("keeps provider references unset until linked", () => {
    const backend = new BackendBase();
    const database = new DatabaseBase();
    const auth = new AuthBase();
    expect(backend.storage).toBeUndefined();
    expect(backend._auth).toBeUndefined();
    expect(backend._database).toBeUndefined();
    expect(database._backend).toBeUndefined();
    expect(database._auth).toBeUndefined();
    expect(auth._database).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(BackendBase.prototype, "storage").set).toBeUndefined();
});

it("links and replaces Firebase client storage after independent construction", () => {
    const backend = new FirebaseBackendClient({firebase: {app: {}}});
    expect(backend.storage).toBeUndefined();
    const storage = {delete: vi.fn()};
    backend.setStorage(storage);
    expect(backend.storage).toBe(storage);
    const replacement = {delete: vi.fn()};
    backend.setStorage(replacement);
    expect(backend.storage).toBe(replacement);
});

it("resolves Local users on each call, including sign-out and provider replacement", async () => {
    const backend = new LocalBackend({storageId: "provider-links"});
    await expect(backend.getCurrentUser()).resolves.toBeUndefined();
    let user = {id: "alice"};
    const auth = {resolveCurrentUser: vi.fn(async () => user)};
    backend.setAuth(auth);
    await expect(backend.getCurrentUser()).resolves.toBe("alice");
    user = {id: "bob"};
    await expect(backend.getCurrentUser()).resolves.toBe("bob");
    user = {id: ""};
    await expect(backend.getCurrentUser()).resolves.toBeUndefined();
    backend.setAuth({resolveCurrentUser: async () => ({id: "replacement"})});
    await expect(backend.getCurrentUser()).resolves.toBe("replacement");
    const failure = new Error("auth failed");
    backend.setAuth({resolveCurrentUser: async () => { throw failure; }});
    await expect(backend.getCurrentUser()).rejects.toBe(failure);
});

it.each(["actor", undefined])("attributes tag ownership changes to %s", async uid => {
    const backend = new BackendBase();
    backend.setAuth({resolveCurrentUser: async () => ({id: uid})});
    backend.request = vi.fn();
    Object.defineProperty(backend, "TIMESTAMP", {value: 123});
    const listener = new TagListener(backend);
    const previous = {id: "tag", uid: "old-owner"};
    const value = {...previous, uid: "new-owner"};
    await listener.onUpdate({params: {tag_id: "tag-key"}, previous, value});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.create", ["activity", "activity_id"], {
        uid: uid ?? 0, type: "tag.change.owner", timestamp: 123,
        details: {id: "tag", uid: {new: "new-owner", old: "old-owner"}},
    });
    backend.request.mockClear();
    await listener.onUpdate({params: {tag_id: "tag-key"}, previous: value, value});
    expect(backend.request).not.toHaveBeenCalled();
});
