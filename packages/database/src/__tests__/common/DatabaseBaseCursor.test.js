import {vi} from "vitest";
import DatabaseBase from "../../common/DatabaseBase";
import DatabaseCursor from "../../common/DatabaseCursor";

class EntriesCursor extends DatabaseCursor {
    constructor() {
        super("custom");
    }

    async next(n = 1) {
        await super.next(n);
        this._position = {index: 0, key: "a", finished: true};
        return [{key: "a", value: 1}];
    }
}

it("keeps literal and array paths as single cursor sources", async () => {
    const database = new DatabaseBase();
    const path = ["records", {owner: "a"}, "record_id"];
    expect(database.cursor("records", {group: "Records"}).path).toBe("records");
    expect(database.cursor(path).path).toEqual(path);
    expect(database.cursor([]).path).toEqual([]);
});

it("composes descriptions and cursors while skipping absent sources", async () => {
    const database = new DatabaseBase();
    const source = new EntriesCursor();
    const cursor = database.cursor([undefined, source, null]);
    expect(cursor.path).toBeUndefined();
    expect(await cursor.next()).toEqual([{key: "a", value: 1}]);

    const described = database.cursor([{path: "first"}, {path: "second"}]);
    expect(described.path).toBeUndefined();
    await expect(described.status()).rejects.toThrow("exactly one source");
    expect(await database.cursor([null, undefined]).next()).toEqual([]);
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
        const cursor = database.cursor([{path: "records", id: "source"}]);
        expect((await cursor.status()).state).toBe("ready");
        expect(statusCall).toHaveBeenCalledOnce();
        expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.read", ["meta", {setting: "cursor:source"}]);
    } finally {
        statusCall.mockRestore();
    }
});
