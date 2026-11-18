import {mutualRequest, mutualRequestAccept, mutualRequestReject} from "../../../components/MutualComponent/mutualComponentControls";
import {MutualMode} from "../../../components/MutualComponent/MutualConstants";

it("does not create a duplicate direct relationship", async () => {
    const database = {cursor: vi.fn(() => ({next: async () => [{key: "existing"}]})), create: vi.fn()};
    expect(await mutualRequest({database, currentUserData: {id: "me"}, mutualId: "them", typeId: "friend"})).toBeNull();
    expect(database.cursor).toHaveBeenCalledExactlyOnceWith(["mutual", {mutual_type: "friend"}, "mutual_id"],
        {equalTo: "me_them", orderBy: ["uid_id"]});
    expect(database.create).not.toHaveBeenCalled();
});
it("accepts or rejects the concrete selected request", async () => {
    const database = {update: vi.fn().mockResolvedValue(null), delete: vi.fn().mockResolvedValue(null)};
    const args = {database, requestId: "request", typeId: "friend"};
    await mutualRequestAccept(args);
    await mutualRequestReject(args);
    const path = ["mutualrequests", {mutual_type: "friend"}, {mutual_id: "request"}];
    expect(database.update).toHaveBeenCalledExactlyOnceWith(path, {accepted: true});
    expect(database.delete).toHaveBeenCalledExactlyOnceWith(path);
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
