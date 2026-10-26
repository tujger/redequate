import {vi} from "vitest";
import AuthBase from "../../AuthBase";
import LocalAuth from "../../local";
import FirebaseAuth from "../../firebase";
import {read, write} from "../../local/common";
import {openLocalDatabase} from "../../../../common/src/localDatabase";
import {createDatabase} from "../fixtures/database";
import {installIndexedDB, rawRecord} from "../fixtures/indexedDB";

vi.mock("firebase/auth", () => ({getAuth: vi.fn(app => app)}));

beforeEach(() => {
    installIndexedDB();
    vi.spyOn(Math, "random").mockReturnValue(0);
});

it("opens redequate:local lazily and preserves Auth store keys in the shared schema", async () => {
    const open = vi.spyOn(indexedDB, "open");
    const auth = new LocalAuth();
    expect(open).not.toHaveBeenCalled();
    await auth.resolveCurrentUser({skipDelay: true});
    expect(open).toHaveBeenCalledWith("redequate:local", undefined);
    const database = await openLocalDatabase();
    try {
        expect([...database.objectStoreNames]).toEqual(["$auth", "$messaging", "$storage"]);
        const transaction = database.transaction([...database.objectStoreNames]);
        expect(transaction.objectStore("$auth").keyPath).toEqual(["kind", "key"]);
        expect(transaction.objectStore("$messaging").keyPath).toBe("key");
        expect(transaction.objectStore("$storage").keyPath).toBe("fullPath");
        const index = transaction.objectStore("$auth").index("email");
        expect(index.unique).toBe(true);
        expect(index.keyPath).toBe("accountEmail");
    } finally { database.close(); }
});

it("uses key across account, session and profile, while keeping mail/link keys stable", async () => {
    const database = createDatabase();
    const auth = new LocalAuth({database});
    const user = await auth.createUserWithEmailAndPassword("key@example.test", "password");
    await auth.sendSignInLinkToEmail(user.email);
    await auth.sendPasswordResetEmail(user.email);
    const before = await read(auth);
    expect(before.accounts[0]).toMatchObject({key: user.id, email: user.email});
    expect(before.accounts[0]).not.toHaveProperty("uid");
    expect(before.session.key).toBe(user.id);
    expect(await database.read(["users_public", {user_id: user.id}, {email: "email"}])).toBe(user.email);
    const keys = [before.accounts[0].key, before.links[0].key, ...before.mail.map(record => record.key)];
    expect(new Set(keys).size).toBe(keys.length);
    await auth.updatePassword("changed-password");
    const after = await read(auth);
    expect(after.links.map(record => record.key)).toEqual(before.links.map(record => record.key));
    expect(after.mail.map(record => record.key)).toEqual(before.mail.map(record => record.key));
    const messages = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    await auth.signOut();
    expect(messages).toHaveBeenLastCalledWith({namespace: auth.storageId, revision: expect.any(String)});
});

it("retains unique email constraints without merging different namespaces", async () => {
    const database = createDatabase();
    const auth = new LocalAuth({database});
    await auth.createUserWithEmailAndPassword("unique@example.test", "password");
    const account = (await read(auth)).accounts[0];
    await expect(rawRecord("$auth", {kind: "accounts", key: "collision", accountEmail: account.email, value: {...account, key: "collision"}})).rejects.toMatchObject({name: "ConstraintError"});
    const other = new LocalAuth({database, storageId: "other"});
    const user = await other.createUserWithEmailAndPassword(account.email, "password");
    expect(user.id).not.toBe(account.key);
    expect((await read(auth)).accounts).toHaveLength(1);
    expect((await read(other)).accounts).toHaveLength(1);
});

it("serializes revision checks and preserves the winning transaction", async () => {
    const auth = new LocalAuth();
    const state = await read(auth);
    const results = await Promise.allSettled([write(auth, state), write(auth, state)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected").reason).toMatchObject({code: "auth/state-changed"});
    const winner = results.find(result => result.status === "fulfilled").value;
    expect((await read(auth)).revision).toBe(winner.revision);
});

it("neither reads nor deletes legacy localStorage and never falls back to it", async () => {
    window.localStorage.setItem("redequate:auth:local", "legacy document");
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    const auth = new LocalAuth({database: createDatabase()});
    expect((await auth.resolveCurrentUser({skipDelay: true})).id).toBeUndefined();
    await auth.createUserWithEmailAndPassword("fresh@example.test", "password");
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new Error("denied"); });
    await expect(auth.resolveCurrentUser({skipDelay: true})).rejects.toMatchObject({code: "auth/storage-unavailable"});
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
});

it("centralizes model defaults and validates ids before model construction", () => {
    const base = new AuthBase();
    const user = base._createUserData({id: "model", public: {email: "model@example.test"}});
    expect(user.toJSON()).toMatchObject({id: "model", role: null, private: {}, requested: expect.any(Number), loaded: {public: true, name: true, email: true, image: true}});
    const loaded = {public: false};
    const custom = base._createUserData({id: "custom", public: {}, role: "admin", private: {device: {locale: "en"}}, requested: 123, loaded});
    expect(custom.toJSON()).toMatchObject({role: "admin", private: {device: {locale: "en"}}, requested: 123, loaded});
    expect(base._createUserData().id).toBeUndefined();
    for (const id of [null, undefined, "", 42]) expect(() => base._createUserData({id, public: {}})).toThrow(expect.objectContaining({code: "auth/invalid-user-data"}));
});

it.each([AuthBase, LocalAuth, FirebaseAuth])("keeps implementation methods prefixed with _ in %s", Auth => {
    const operations = new Set([
        "constructor", "checkSignInWithEmailLink", "createUserWithEmailAndPassword", "onAuthStateChanged",
        "resolveRedirectResult", "resolveCurrentUser", "sendEmailVerification", "sendPasswordResetEmail", "sendSignInLinkToEmail",
        "signInWithEmailAndPassword", "signInWithPopup", "signInWithRedirect", "signInWithCredential", "signInWithEmailLink",
        "signOut", "updatePassword", "updateProfile"
    ]);
    const internal = Object.getOwnPropertyNames(Auth.prototype).filter(name => !operations.has(name));
    expect(internal.every(name => name.startsWith("_"))).toBe(true);
});
