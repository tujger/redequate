import DatabaseCursor from "../../../../packages/database/src/common/DatabaseCursor";
import {mutualRequest, mutualRequestsCursor} from "../../../components/MutualComponent/mutualComponentControls";
import {MutualMode} from "../../../components/MutualComponent/MutualConstants";

class RequestCursor extends DatabaseCursor {
    constructor(entries, options) {
        super(options, ["mutualrequests", {mutual_type: "friend"}]);
        this.entries = entries;
        this.offset = 0;
    }
    async next(n = 1) {
        await super.next(n);
        const page = this.entries.slice(this.offset, this.offset + n);
        this.offset += page.length;
        this._position = Object.freeze({index: this.offset - 1, key: page.at(-1)?.key,
            finished: this.offset === this.entries.length});
        return page;
    }
}

it.each([
    [false, "uid", "id", [{uid: "me", id: "other"}, {uid: "me", id: "them"}]],
    [true, "id", "uid", [{uid: "other", id: "me"}, {uid: "them", id: "me"}]]
])("queries %s requests by the current user and scans past another counterpart", async (incoming, field, counterpart, values) => {
    const database = {cursor: vi.fn((path, options) => new RequestCursor(
        values.map((value, index) => ({key: `r${index}`, value})), options))};
    const cursor = mutualRequestsCursor({database, typeId: "friend", userId: "me", counterpartId: "them", incoming});
    expect(await cursor.next()).toEqual([{key: "r1", value: values[1]}]);
    expect(database.cursor).toHaveBeenCalledWith(["mutualrequests", {mutual_type: "friend"}, "mutual_id"],
        {orderBy: [field], equalTo: "me"});
    expect(values[1][counterpart]).toBe("them");
});

it.each([
    [MutualMode.DUPLEX_APPROVE, "mutualrequests", false],
    [MutualMode.SIMPLEX_QUIET, "mutual", true]
])("creates %s records with compound fields only for direct mutuals", async (mutualMode, collection, compounds) => {
    const database = {
        TIMESTAMP: {".sv": "timestamp"},
        cursor: vi.fn(() => ({next: async () => []})),
        create: vi.fn(async () => "new-request")
    };
    const result = await mutualRequest({database, currentUserData: {id: "me"}, mutualId: "them",
        mutualMode, mutualType: "users_public", typeId: "friend", message: "hello"});
    expect(database.create).toHaveBeenCalledWith([collection, {mutual_type: "friend"}, "mutual_id"],
        expect.objectContaining({uid: "me", id: "them"}));
    const value = database.create.mock.calls[0][1];
    expect(Object.hasOwn(value, "uid_id")).toBe(compounds);
    expect(Object.hasOwn(value, "id_uid")).toBe(compounds);
    if (compounds) expect(value).toMatchObject({uid_id: "me_them", id_uid: "them_me"});
    expect(result.value).toMatchObject({uid: "me", id: "them"});
    expect(Object.hasOwn(result.value, "uid_id")).toBe(compounds);
});
