import {vi} from "vitest";
import {cacheDatas} from "../../../../src/controllers/General";
import {UserData as CommonUserData} from "../UserData.js";
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
    const user = new CommonUserData().fromJSON(json);
    expect(user).toMatchObject({id: "json-user", name: "JSON User", verified: true});
    expect(user.toJSON()).toMatchObject({requested: 1234, loaded: {public: true}});
    expect(user).not.toHaveProperty("fromAuth");
});
it("round-trips JSON without Firebase and retains private and loaded fields", () => {
    const user = new CommonUserData().fromJSON({
        id: "round-trip",
        role: UserRole.ADMIN,
        public: {name: "Alice Smith", email: "alice@example.test", emailVerified: true, image: "image", created: 1234},
        private: {device: {locale: "ru"}},
        requested: 5678,
        loaded: {public: true, private: true}
    });
    const json = JSON.parse(JSON.stringify(user));
    const restored = new CommonUserData().fromJSON(json);
    expect(restored.toJSON()).toEqual(json);
    expect(restored).toMatchObject({id: "round-trip", name: "Alice Smith", initials: "AS", email: "alice@example.test", image: "image", verified: true, role: UserRole.ADMIN, disabled: false});
    expect(restored.private).toEqual({device: {locale: "ru"}});
});
it.each([[true, UserRole.USER], [false, UserRole.USER_NOT_VERIFIED]])("derives role from verification %s when no role is set", (verified, role) => {
    const user = new CommonUserData().create("user", {email: "alice@example.test", emailVerified: verified});
    expect(user.role).toBe(role);
    expect(user.name).toBe("alice@example.test");
    expect(user.verified).toBe(verified);
    expect(user.disabled).toBe(false);
});
it("preserves an explicit disabled role", () => {
    const user = new CommonUserData().create("user", UserRole.DISABLED, {name: "Disabled", emailVerified: true});
    expect(user.role).toBe(UserRole.DISABLED);
    expect(user.disabled).toBe(true);
});

it.each([CommonUserData, UserData])("formats numeric dates without a database in %s", Model => {
    vi.useFakeTimers();
    try {
        vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
        const created = new Date("2026-10-11T09:00:00Z").getTime();
        const updated = new Date("2026-10-10T09:00:00Z").getTime();
        const user = new Model().create("timestamp", {created, updated});
        expect(user.created).toBe(new Date(created).toLocaleTimeString());
        expect(user.updated).toBe(new Date(updated).toLocaleDateString());
        expect(user.date()).toBe(new Date(created).toLocaleString());
    } finally {
        vi.useRealTimers();
    }
});

it.each([CommonUserData, UserData])("returns empty dates for an anonymous %s", Model => {
    const user = new Model();
    expect(user.created).toBe("");
    expect(user.updated).toBe("");
    expect(user.date()).toBe("");
});

it("does not mistake an absent database marker for an empty date", () => {
    const user = new UserData({});
    expect(user.created).toBe("");
    expect(user.updated).toBe("");
});

it("formats the exact provider marker in the frontend model", () => {
    vi.useFakeTimers();
    try {
        vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
        const database = {TIMESTAMP: {kind: "server-timestamp"}};
        const user = new UserData(database).create("timestamp", {
            created: database.TIMESTAMP, updated: database.TIMESTAMP,
        });
        expect(user.created).toBe(new Date().toLocaleTimeString());
        expect(user.updated).toBe(new Date().toLocaleTimeString());
        // Equal-looking objects are not the provider's sentinel.
        user.update({public: {created: {...database.TIMESTAMP}, updated: {...database.TIMESTAMP}}});
        expect(user.created).not.toBe(new Date().toLocaleTimeString());
        expect(user.updated).not.toBe(new Date().toLocaleTimeString());
    } finally {
        vi.useRealTimers();
    }
});

it("formats resolved numeric dates with a provider present", () => {
    const user = new UserData({TIMESTAMP: {kind: "server-timestamp"}}).create("numeric", {created: 1000, updated: 2000});
    expect(user.created).toBe(new Date(1000).toLocaleDateString());
    expect(user.updated).toBe(new Date(2000).toLocaleDateString());
});

it("exports detached nested JSON and lets a replacement model edit it independently", async () => {
    const user = new CommonUserData().create("original", {
        public: {name: "Original", preferences: {theme: "dark"}},
        private: {device: {locale: "en"}},
    });
    const json = user.toJSON();
    json.public.preferences.theme = "light";
    json.private.device.locale = "ru";
    expect(user.public.preferences.theme).toBe("dark");
    expect(user.private.device.locale).toBe("en");
    const replacement = new CommonUserData().fromJSON(json);
    expect(await replacement.set({name: "Replacement"})).toBe(replacement);
    await replacement.setPrivate("device", {locale: "fr"});
    replacement.update({name: "Updated"});
    expect(replacement.name).toBe("Updated");
    expect(replacement.private.device.locale).toBe("fr");
    expect(user.name).toBe("Original");
    expect(user.private.device.locale).toBe("en");
});

it("saves a public profile through the frontend adapter using the database timestamp", async () => {
    const database = {update: vi.fn().mockResolvedValue(), TIMESTAMP: {kind: "server-timestamp"}};
    const user = new UserData(database).create("save-user", {name: " Alice ", email: "alice@example.test"});
    expect(await user.savePublic()).toBe(user);
    expect(database.update).toHaveBeenCalledTimes(1);
    const updates = database.update.mock.calls[0][0];
    expect(updates).toBeInstanceOf(Map);
    expect([...updates]).toEqual(expect.arrayContaining([
        [["users_public", {user_id: "save-user"}, "name"], "Alice"],
        [["users_public", {user_id: "save-user"}, "updated"], database.TIMESTAMP],
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
        read: vi.fn(async path => structuredClone(values[path.map(segment => typeof segment === "string" ? segment : Object.values(segment)[0]).join("/")])),
        update: vi.fn().mockResolvedValue(),
        TIMESTAMP: {kind: "server-timestamp"},
    };
    const user = new UserData(database);
    expect(await user.fetch("fetched", [UserData.FULL])).toBe(user);
    expect(user).toMatchObject({id: "fetched", name: "Fetched", role: UserRole.ADMIN, persisted: true});
    expect(user.toJSON()).toMatchObject({loaded: {public: true, private: true, role: true}, requested: expect.any(Number)});
    expect(await user.set({name: " Changed "})).toBe(user);
    await user.setPrivate("device", {locale: "ru"});
    expect(await user.save()).toBe(user);
    expect(database.read.mock.calls).toEqual([
        [["users_public", {user_id: "fetched"}]],
        [["users_private", {user_id: "fetched"}]],
        [["roles", {user_id: "fetched"}]],
    ]);
    expect(database.update).toHaveBeenCalledTimes(1);
    const updates = database.update.mock.calls[0][0];
    expect(updates).toBeInstanceOf(Map);
    expect([...updates]).toEqual(expect.arrayContaining([
        [["users_public", {user_id: "fetched"}, "name"], "Changed"],
        [["users_private", {user_id: "fetched"}, {device_id: "device"}, "locale"], "ru"],
    ]));
});

it("removes the frontend cache entry after deleting a profile", async () => {
    const database = {delete: vi.fn().mockResolvedValue()};
    const remove = vi.spyOn(cacheDatas, "remove").mockImplementation(() => {});
    const user = new UserData(database).create("deleted", {name: "Deleted"});
    expect(await user.delete()).toBe(user);
    expect(database.delete).toHaveBeenCalledWith(["users_public", {user_id: "deleted"}]);
    expect(remove).toHaveBeenCalledWith("deleted");
});
