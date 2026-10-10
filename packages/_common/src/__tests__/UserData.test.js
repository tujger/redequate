import {Role, UserData} from "../UserData";

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
        role: Role.ADMIN,
        public: {name: "Alice Smith", email: "alice@example.test", emailVerified: true, image: "image", created: 1234},
        private: {device: {locale: "ru"}},
        requested: 5678,
        loaded: {public: true, private: true}
    });
    const json = JSON.parse(JSON.stringify(user));
    const restored = new UserData().fromJSON(json);
    expect(restored.toJSON()).toEqual(json);
    expect(restored).toMatchObject({id: "round-trip", name: "Alice Smith", initials: "AS", email: "alice@example.test", image: "image", verified: true, role: Role.ADMIN, disabled: false});
    expect(restored.private).toEqual({device: {locale: "ru"}});
});
it.each([[true, Role.USER], [false, Role.USER_NOT_VERIFIED]])("derives role from verification %s when no role is set", (verified, role) => {
    const user = new UserData().create("user", {email: "alice@example.test", emailVerified: verified});
    expect(user.role).toBe(role);
    expect(user.name).toBe("alice@example.test");
    expect(user.verified).toBe(verified);
    expect(user.disabled).toBe(false);
});
it("preserves an explicit disabled role", () => {
    const user = new UserData().create("user", Role.DISABLED, {name: "Disabled", emailVerified: true});
    expect(user.role).toBe(Role.DISABLED);
    expect(user.disabled).toBe(true);
});
