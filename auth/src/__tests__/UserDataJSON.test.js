import {vi} from "vitest";
import FirebaseAuth from "../firebase";
import LocalTestAuth from "../local-test";

beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(123456);
    vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => window.localStorage.clear());

const restore = (provider, uid = "json-user") => {
    const account = {
        uid,
        email: "json@example.test",
        displayName: "JSON User",
        photoURL: "https://example.test/photo",
        emailVerified: true,
        createdAt: 1234,
        lastLoginAt: 5678,
        provider: "password",
        password: "hidden"
    };
    if (provider === "firebase") {
        const data = {...account, createdAt: "1234", lastLoginAt: "5678", providerData: [{providerId: "password"}]};
        const user = {...data, toJSON: () => structuredClone(data), updatePassword: vi.fn()};
        return new FirebaseAuth({firebase: {auth: () => ({currentUser: user})}}).resolveCurrentUser();
    }
    const auth = new LocalTestAuth();
    window.localStorage.setItem(auth.storageKey, JSON.stringify({
        version: 1,
        accounts: [account],
        session: {uid, token: "hidden"},
        redirect: null,
        links: [],
        mail: []
    }));
    return auth.resolveCurrentUser();
};

it.each(["firebase", "local-test"])("restores normalized UserData through %s", async provider => {
    const user = await restore(provider);
    expect(user).toMatchObject({id: "json-user", _userData: true, verified: true});
    const json = user.toJSON();
    expect(json).toMatchObject({
        id: "json-user",
        role: null,
        public: {
            name: "JSON User",
            email: "json@example.test",
            emailVerified: true,
            image: "https://example.test/photo",
            provider: "password",
            created: 1234,
            lastLogin: 5678
        },
        private: {},
        requested: 123456,
        loaded: {public: true, name: true, email: true, image: true}
    });
    expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    expect(JSON.stringify(json)).not.toContain("hidden");
    expect(user).not.toHaveProperty("updatePassword");
    expect(user).not.toHaveProperty("uid");
    expect(user).not.toHaveProperty("user");
});
it.each(["firebase", "local-test"])("rejects malformed %s user records with Error", async provider => {
    await expect(restore(provider, "")).rejects.toThrow(Error);
});
