import {vi} from "vitest";
import {cacheDatas} from "../../controllers/General";
import CommonUserData from "../../../packages/common/src/UserData.js";
import {UserRole} from "../../../packages/common/src/UserRole";
import UserData from "../../controllers/UserData";

it.each([UserData])("formats numeric dates without a database in %s", Model => {
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

it.each([UserData])("returns empty dates for an anonymous %s", Model => {
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

it("saves a public profile through the frontend adapter using the database timestamp", async () => {
    const database = {update: vi.fn().mockResolvedValue(), TIMESTAMP: {kind: "server-timestamp"}};
    const user = new UserData(database).create("save-user", {name: " Alice ", email: "alice@example.test"});
    expect(await user.savePublic()).toBe(user);
    expect(database.update).toHaveBeenCalledTimes(1);
    const updates = database.update.mock.calls[0][0];
    expect(updates).toBeInstanceOf(Map);
    expect([...updates]).toEqual(expect.arrayContaining([
        [["users_public", {user_id: "save-user"}, {name: "name"}], "Alice"],
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
        [["users_public", {user_id: "fetched"}, {name: "name"}], "Changed"],
        [["users_private", {user_id: "fetched"}, {device_id: "device"}, {locale: "locale"}], "ru"],
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
