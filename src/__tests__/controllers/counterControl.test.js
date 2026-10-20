import {vi} from "vitest";
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
    expect(database.read).toHaveBeenCalledWith(["_counters", {UNKNOWN: "post-1/like"}]);
    const unsubscribe = counterControl({database, path: "user-1/mutual/friend", onchange});
    expect(database.addEventListener).toHaveBeenCalledWith(
        ["_counters", {UNKNOWN: "user-1/mutual/friend"}], {onChange: expect.any(Function)}
    );
    unsubscribe();
    expect(remove).toHaveBeenCalledOnce();
});
