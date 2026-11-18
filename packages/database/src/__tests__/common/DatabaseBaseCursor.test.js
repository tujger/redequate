import {vi} from "vitest";
import DatabaseBase from "../../common/DatabaseBase";
import DatabaseCursor from "../../common/DatabaseCursor";

it("normalizes literal and array cursor paths", () => {
    const database = new DatabaseBase();
    const path = ["records", {owner: "a"}, "record_id"];
    expect(database.cursor("records", {group: "Records"}).path).toBe("records");
    expect(database.cursor(path).path).toBe("records/a");
    expect(database.cursor([]).path).toBe("");
});

it("passes its backend and database to cursors created from paths", async () => {
    const backend = {request: vi.fn().mockResolvedValue(null)};
    const database = new DatabaseBase();
    database.setBackend(backend);
    const status = DatabaseCursor.prototype.status;
    const statusCall = vi.spyOn(DatabaseCursor.prototype, "status").mockImplementation(function () {
        expect(this._backend).toBe(backend);
        expect(this._database).toBe(database);
        return status.call(this);
    });
    try {
        const cursor = database.cursor("records");
        expect((await cursor.status()).state).toBe("ready");
        expect(statusCall).toHaveBeenCalledOnce();
        expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.read", ["_checkpoints", {path: "records"}]);
    } finally {
        statusCall.mockRestore();
    }
});

it("uses readable checkpoint keys without collisions between path segments", async () => {
    const backend = {request: vi.fn().mockResolvedValue(null)};
    for (const path of ["chats/room-1", ["chats", {chat_id: "room-1"}, "message_id"],
        "a:b/c", "a/b:c", "a%3Ab/c", "", "!root"]) {
        expect(await new DatabaseCursor(path, {}, {backend}).status()).toMatchObject({
            userId: null, state: "ready"
        });
    }
    expect(backend.request.mock.calls.map(([, [, {path}]]) => path)).toEqual([
        "chats:room-1", "chats:room-1", "a%3Ab:c", "a:b%3Ac", "a%253Ab:c", "!root", "%21root"
    ]);
});

it("rejects root all() before reading checkpoint status", async () => {
    const backend = {request: vi.fn()};
    const cursor = new DatabaseCursor("", {}, {backend});
    await expect(cursor.all()).rejects.toMatchObject({
        code: "database/invalid-argument",
        message: "Cursor all() requires a non-empty path."
    });
    expect(backend.request).not.toHaveBeenCalled();
});
