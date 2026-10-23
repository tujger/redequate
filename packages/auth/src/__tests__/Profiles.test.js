import {installIndexedDB, flushIndexedDB} from "./fixtures/indexedDB";
import {vi} from "vitest";
import {read} from "../local/common";
import LocalAuth from "../local";
import FirebaseAuth from "../firebase";
import {createDatabase} from "./fixtures/database";

vi.mock("firebase/auth", () => ({
    getAuth: vi.fn(app => app),
    createUserWithEmailAndPassword: vi.fn((sdk, ...args) => sdk.createUserWithEmailAndPassword(...args)),
    signInWithEmailAndPassword: vi.fn((sdk, ...args) => sdk.signInWithEmailAndPassword(...args)),
    signOut: vi.fn(sdk => { sdk.currentUser = null; }),
}));

async function run(promise) {
    const pending = promise.then(value => ({value}), error => ({error}));
    await vi.runAllTimersAsync();
    await flushIndexedDB();
    const result = await pending;
    if (result.error) throw result.error;
    return result.value;
}

const createAuth = (Auth, database) => {
    const user = {toJSON: () => ({
        uid: "profile-user", email: "profile@example.test", displayName: null,
        photoURL: null, emailVerified: false, providerData: [{providerId: "password"}]
    })};
    const sdk = {
        currentUser: null,
        authStateReady: vi.fn().mockResolvedValue(),
        createUserWithEmailAndPassword: vi.fn(async () => {
            sdk.currentUser = user;
            return {user};
        }),
        signInWithEmailAndPassword: vi.fn(async () => {
            sdk.currentUser = user;
            return {user};
        }),
    };
    return {auth: new Auth({database, firebase: {app: sdk}}), sdk};
};

beforeEach(() => {
    installIndexedDB();
    window.localStorage.clear();
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "Date"]});
    vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
});

describe.each([["local", LocalAuth], ["firebase", FirebaseAuth]])("%s database profiles", (provider, Auth) => {
    it("persists registration before returning and reads all profile sections on login", async () => {
        const database = createDatabase();
        const {auth} = createAuth(Auth, database);
        const user = await run(auth.createUserWithEmailAndPassword("profile@example.test", "password"));
        expect(await database.read(["users_public", {user_id: user.id}])).toMatchObject({
            email: "profile@example.test", provider: "password", emailVerified: false,
        });
        const paths = database.update.mock.calls.flatMap(([updates]) => [...updates.keys()]);
        expect(paths.some(path => path.includes("password") || path.includes("token"))).toBe(false);
        expect(await database.read(["roles", {user_id: user.id}]))
            .toBe(provider === "local" ? "admin" : undefined);

        await run(auth.updateProfile({
            public: {name: "Stored name", image: "stored.png", extra: "retained"},
            role: "admin",
            private: {device: {locale: "en", agreement: true}}
        }));
        await run(auth.signOut());
        const restored = await run(auth.signInWithEmailAndPassword("profile@example.test", "password"));
        expect(restored).toMatchObject({
            id: user.id, public: {name: "Stored name", image: "stored.png", extra: "retained"},
            role: "admin", private: {device: {locale: "en", agreement: true}}
        });
        expect(await database.read(["roles", {user_id: user.id}])).toBe("admin");
        expect(await database.read(["users_private", {user_id: user.id}, {device_id: "device"}, {locale: "locale"}])).toBe("en");

        await run(auth.updateProfile({public: {name: "Changed", image: undefined}, private: {device: {locale: "fr"}}}));
        expect([...database.update.mock.calls.at(-1)[0]]).toEqual([
            [["users_public", {user_id: user.id}, "name"], "Changed"],
            [["users_private", {user_id: user.id}, {device_id: "device"}, "locale"], "fr"]
        ]);
        const changed = await run(auth.resolveCurrentUser());
        expect(changed).toMatchObject({public: {name: "Changed", image: "stored.png", extra: "retained"},
            role: "admin", private: {device: {locale: "fr", agreement: true}}});
    });

    it("keeps omitted fields and deletes explicitly cleared values", async () => {
        const database = createDatabase();
        const {auth} = createAuth(Auth, database);
        const user = await run(auth.createUserWithEmailAndPassword("profile@example.test", "password"));
        await database.update(new Map([
            [["users_public", {user_id: "other-admin"}], {name: "Other admin"}],
            [["roles", {user_id: "other-admin"}], "admin"]
        ]));
        await run(auth.updateProfile({public: {name: "A", image: "a.png"}, role: "admin", private: {a: {locale: "en", keep: true}}}));
        await run(auth.updateProfile({public: {image: null}, role: null, private: {a: {locale: null}}}));
        expect(await database.read(["users_public", {user_id: user.id}, {name: "name"}])).toBe("A");
        expect(await database.read(["users_public", {user_id: user.id}, {image: "image"}])).toBeUndefined();
        expect(await database.read(["roles", {user_id: user.id}])).toBeUndefined();
        expect(await database.read(["users_private", {user_id: user.id}, {a: "a"}])).toEqual({keep: true});
        database.update.mockClear();
        await run(auth.updateProfile({public: {name: undefined}}));
        expect(database.update).not.toHaveBeenCalled();
    });

    it("rejects demotion of the last administrator before writing any profile fields", async () => {
        const database = createDatabase();
        const {auth} = createAuth(Auth, database);
        const user = await run(auth.createUserWithEmailAndPassword("profile@example.test", "password"));
        await run(auth.updateProfile({role: "admin"}));
        database.update.mockClear();
        await expect(run(auth.updateProfile({role: null, public: {name: "Rejected"}})))
            .rejects.toMatchObject({code: "auth/last-admin"});
        expect(database.update).not.toHaveBeenCalled();
        expect(await database.read(["roles", {user_id: user.id}])).toBe("admin");
    });

    it("rejects registration when the profile cannot be saved", async () => {
        const database = createDatabase();
        const failure = new Error("profile write failed");
        database.update.mockRejectedValue(failure);
        const {auth} = createAuth(Auth, database);
        await expect(run(auth.createUserWithEmailAndPassword("profile@example.test", "password"))).rejects.toBe(failure);
        if (Auth === LocalAuth) expect((await read(auth)).revision).toBeNull();
    });

    it("waits for profile storage before registration resolves", async () => {
        const database = createDatabase();
        const save = database.update.getMockImplementation();
        let finish;
        database.update.mockImplementation(async updates => {
            await new Promise(resolve => { finish = resolve; });
            await save(updates);
        });
        const {auth} = createAuth(Auth, database);
        let completed = false;
        const pending = auth.createUserWithEmailAndPassword("profile@example.test", "password")
            .then(user => { completed = true; return user; });
        await vi.runAllTimersAsync();
    await flushIndexedDB();
        expect(finish).toBeInstanceOf(Function);
        expect(completed).toBe(false);
        finish();
        const user = await pending;
        expect(await database.read(["users_public", {user_id: user.id}, {email: "email"}])).toBe("profile@example.test");
    });

    it("propagates update errors and validates sections before writing", async () => {
        const database = createDatabase();
        const {auth} = createAuth(Auth, database);
        const user = await run(auth.createUserWithEmailAndPassword("profile@example.test", "password"));
        database.update.mockClear();
        for (const fields of [null, [], {public: "invalid"}, {private: false}, {role: 42}]) {
            await expect(run(auth.updateProfile(fields))).rejects.toMatchObject({code: "auth/invalid-argument"});
        }
        expect(database.update).not.toHaveBeenCalled();
        const failure = new Error("write failed");
        database.update.mockRejectedValue(failure);
        await expect(run(auth.updateProfile({public: {name: "Unsaved"}}))).rejects.toBe(failure);
        expect(await database.read(["users_public", {user_id: user.id}, {name: "name"}])).toBeUndefined();
    });

    it("requires a database for registration and a current user for updates", async () => {
        const {auth, sdk} = createAuth(Auth);
        await expect(run(auth.createUserWithEmailAndPassword("profile@example.test", "password")))
            .rejects.toMatchObject({code: "auth/database-required"});
        expect(sdk.createUserWithEmailAndPassword).not.toHaveBeenCalled();
        auth.database = createDatabase();
        await expect(run(auth.updateProfile({public: {name: "No session"}})))
            .rejects.toMatchObject({code: "auth/no-current-user"});
    });
});
