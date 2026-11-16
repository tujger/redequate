import createLocalDatabase from "../../../../database/src/__tests__/createLocalDatabase";
import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";

import loadUserData from "../../common/loadUserData";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const created = value => value;

it("loads private devices into the user profile through LocalDatabase", async () => {
    const database = createLocalDatabase({storageId: "private-profile"});
    await database.read(["posts"]);
    await database.update(new Map([
        [["users_private", {user_id: "u1"}, {device_id: "phone"}, "locale"], "en"],
        [["users_private", {user_id: "u1"}, {device_id: "phone"}, "enabled"], true]
    ]));
    const state = {private: {}, loaded: {}};
    const user = {id: "u1", _getState: () => state};
    expect(await loadUserData(user, database)).toBe(user);
    expect(state.private.phone).toEqual(created({locale: "en", enabled: true}));
    expect(state.loaded.private).toBe(true);
});
