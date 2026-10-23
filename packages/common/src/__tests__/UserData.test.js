import {vi} from "vitest";
import CommonUserData from "../UserData.js";
import {UserRole} from "../UserRole";

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

it.each([CommonUserData])("formats numeric dates without a database in %s", Model => {
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

it.each([CommonUserData])("returns empty dates for an anonymous %s", Model => {
    const user = new Model();
    expect(user.created).toBe("");
    expect(user.updated).toBe("");
    expect(user.date()).toBe("");
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
