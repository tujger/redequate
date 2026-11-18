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
        expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.read", ["meta", {setting: `cursor:${cursor.id}`}]);
    } finally {
        statusCall.mockRestore();
    }
});
