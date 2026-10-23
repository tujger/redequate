import {createDatabase} from "../fixtures/database";
import AuthBase from "../../AuthBase";

it("saves the initial profile without deciding an administrator role", async () => {
    const database = createDatabase();
    const auth = new AuthBase({database});
    const user = {id: "one", public: {name: "One"}, private: {}};
    await auth._saveInitialProfile(user);
    expect(database.read).not.toHaveBeenCalled();
    expect(await database.read(["users_public", {user_id: user.id}])).toEqual(user.public);
    expect(await database.read(["roles", {user_id: user.id}])).toBeUndefined();
});

it("persists initial profile fields explicitly supplied by a provider in one batch", async () => {
    const database = createDatabase();
    const auth = new AuthBase({database});
    const user = {id: "one", public: {name: "One"}, private: {}};
    await auth._saveInitialProfile(user, {public: user.public, private: user.private, role: "admin"});
    expect(database.read).not.toHaveBeenCalled();
    expect(database.update).toHaveBeenCalledTimes(1);
    expect([...database.update.mock.calls[0][0]]).toEqual([
        [["users_public", {user_id: user.id}, "name"], "One"],
        [["roles", {user_id: user.id}], "admin"]
    ]);
});
