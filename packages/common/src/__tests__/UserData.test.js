import {vi} from "vitest";
import {cacheDatas} from "../../../../src/controllers/General";
import {UserData as CommonUserData} from "../UserData.js";
import {SERVER_TIMESTAMP} from "../constants.js";
import {UserRole} from "../UserRole";
import {UserData} from "../../../../src/controllers/UserData";

it("restores request time and loaded state through fromJSON", () => {
    const json = {
        id: "json-user",
        role: null,
        public: {name: "JSON User", email: "json@example.test", emailVerified: true},
        private: {device: {locale: "en"}},
        requested: 1234,
        loaded: {public: true}
    };
    const user = new UserData().fromJSON(json);
    expect(user).toMatchObject({id: "json-user", name: "JSON User", verified: true});
    expect(user.toJSON()).toMatchObject({requested: 1234, loaded: {public: true}});
    expect(user).not.toHaveProperty("fromAuth");
});
it("round-trips JSON without Firebase and retains private and loaded fields", () => {
    const user = new UserData().fromJSON({
        id: "round-trip",
        role: UserRole.ADMIN,
        public: {name: "Alice Smith", email: "alice@example.test", emailVerified: true, image: "image", created: 1234},
        private: {device: {locale: "ru"}},
        requested: 5678,
        loaded: {public: true, private: true}
    });
    const json = JSON.parse(JSON.stringify(user));
    const restored = new UserData().fromJSON(json);
    expect(restored.toJSON()).toEqual(json);
    expect(restored).toMatchObject({id: "round-trip", name: "Alice Smith", initials: "AS", email: "alice@example.test", image: "image", verified: true, role: UserRole.ADMIN, disabled: false});
    expect(restored.private).toEqual({device: {locale: "ru"}});
});
it.each([[true, UserRole.USER], [false, UserRole.USER_NOT_VERIFIED]])("derives role from verification %s when no role is set", (verified, role) => {
    const user = new UserData().create("user", {email: "alice@example.test", emailVerified: verified});
    expect(user.role).toBe(role);
    expect(user.name).toBe("alice@example.test");
    expect(user.verified).toBe(verified);
    expect(user.disabled).toBe(false);
});
it("preserves an explicit disabled role", () => {
    const user = new UserData().create("user", UserRole.DISABLED, {name: "Disabled", emailVerified: true});
    expect(user.role).toBe(UserRole.DISABLED);
    expect(user.disabled).toBe(true);
});

it("formats timestamp markers restored from JSON by their contents", () => {
    vi.useFakeTimers();
    try {
        vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
        const user = new UserData().create("timestamp", {
            created: {".sv": "timestamp"}, updated: {".sv": "timestamp"},
        });
        expect(user.created).toBe(new Date().toLocaleTimeString());
        expect(user.updated).toBe(new Date().toLocaleTimeString());
    } finally {
        vi.useRealTimers();
    }
});

it("saves a public profile through the frontend adapter using the database timestamp", async () => {
    const database = {update: vi.fn().mockResolvedValue(), TIMESTAMP: SERVER_TIMESTAMP};
    const user = new UserData(database).create("save-user", {name: " Alice ", email: "alice@example.test"});
    expect(await user.savePublic()).toBe(user);
    expect(database.update).toHaveBeenCalledTimes(1);
    const updates = database.update.mock.calls[0][0];
    expect(updates).toBeInstanceOf(Map);
    expect([...updates]).toEqual(expect.arrayContaining([
        [["users_public", "save-user", "name"], "Alice"],
        [["users_public", "save-user", "updated"], database.TIMESTAMP],
    ]));
    expect(user.persisted).toBe(true);
});

it("extends the shared model without accessing the database during construction", () => {
    const database = {read: vi.fn(), update: vi.fn(), delete: vi.fn()};
    const user = new UserData(database).create("lazy", {name: "Lazy"});
    expect(database.read).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
    expect(database.delete).not.toHaveBeenCalled();
    expect(UserData.PUBLIC).toBe(CommonUserData.PUBLIC);
    expect(user.fetch).toBeTypeOf("function");
    expect(new CommonUserData().fetch).toBeUndefined();
});

it("shares fetched state with getters, serialization and subsequent saves", async () => {
    const values = {
        "users_public/fetched": {name: "Fetched", email: "user@example.test", created: 1000},
        "users_private/fetched": {device: {locale: "en"}},
        "roles/fetched": UserRole.ADMIN,
    };
    const database = {
        read: vi.fn(async path => structuredClone(values[path.join("/")])),
        update: vi.fn().mockResolvedValue(),
        TIMESTAMP: SERVER_TIMESTAMP,
    };
    const user = new UserData(database);
    expect(await user.fetch("fetched", [UserData.FULL])).toBe(user);
    expect(user).toMatchObject({id: "fetched", name: "Fetched", role: UserRole.ADMIN, persisted: true});
    expect(user.toJSON()).toMatchObject({loaded: {public: true, private: true, role: true}, requested: expect.any(Number)});
    expect(await user.set({name: " Changed "})).toBe(user);
    await user.setPrivate("device", {locale: "ru"});
    expect(await user.save()).toBe(user);
    expect(database.read.mock.calls).toEqual([
        [["users_public", "fetched"]],
        [["users_private", "fetched"]],
        [["roles", "fetched"]],
    ]);
    expect(database.update).toHaveBeenCalledTimes(1);
    const updates = database.update.mock.calls[0][0];
    expect(updates).toBeInstanceOf(Map);
    expect([...updates]).toEqual(expect.arrayContaining([
        [["users_public", "fetched", "name"], "Changed"],
        [["users_private", "fetched", "device", "locale"], "ru"],
    ]));
});

it("removes the frontend cache entry after deleting a profile", async () => {
    const database = {delete: vi.fn().mockResolvedValue()};
    const remove = vi.spyOn(cacheDatas, "remove").mockImplementation(() => {});
    const user = new UserData(database).create("deleted", {name: "Deleted"});
    expect(await user.delete()).toBe(user);
    expect(database.delete).toHaveBeenCalledWith(["users_public", "deleted"]);
    expect(remove).toHaveBeenCalledWith("deleted");
});
