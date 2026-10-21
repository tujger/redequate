import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../../packages/database/src/local";
import counterControl from "../../controllers/counterControl";

vi.mock("../../controllers/Firebase", () => ({firebaseMessaging: {database: () => ({})}}));

it("retains composite counter addresses for reads and listeners", async () => {
    const remove = vi.fn();
    const database = {
        read: vi.fn(async () => 3),
        addEventListener: vi.fn(() => ({remove}))
    };
    const onchange = vi.fn();

    expect(await counterControl({database, path: ["post-1", "like"]})).toBe(3);
    expect(database.read).toHaveBeenCalledWith(["_counters", "post-1", {like: "like"}]);
    const unsubscribe = counterControl({database, path: "user-1/mutual/friend", onchange});
    expect(database.addEventListener).toHaveBeenCalledWith(
        ["_counters", "user-1/mutual/friend"], {onChange: expect.any(Function)}
    );
    unsubscribe();
    expect(remove).toHaveBeenCalledOnce();
});

describe("Local database updates", () => {
    beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
    afterEach(() => vi.unstubAllGlobals());

    it("returns a plain counter value through counterControl for the likes caller", async () => {
        const database = new LocalDatabase({storageKey: "likes"});
        expect(await counterControl({database, path: [{post_id: "p1"}, "like"], increment: 1})).toBe(1);
        expect(await counterControl({database, path: [{post_id: "p1"}, "like"], increment: -1})).toBeNull();
    });
});
