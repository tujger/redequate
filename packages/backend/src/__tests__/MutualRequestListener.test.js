import MutualRequestListener from "../common/handlers/mutualrequests";

it("derives both mutual directions from request uid and id on acceptance", async () => {
    const cursor = {next: vi.fn(async () => [])};
    const backend = {request: vi.fn(async name => name === "database.cursor" ? cursor : "created")};
    const listener = new MutualRequestListener(backend);
    const path = ["mutual", {mutual_type: "friend"}, "mutual_id"];
    await listener.onUpdate({params: {mutual_type: "friend", mutual_id: "r1"}, previous: {accepted: false},
        value: {uid: "alice", id: "bob", accepted: true, timestamp: 123}});
    expect(backend.request.mock.calls).toEqual([
        ["database.create", path, {uid: "alice", id: "bob", uid_id: "alice_bob", id_uid: "bob_alice", timestamp: 123}],
        ["database.cursor", path, {equalTo: "bob_alice", orderBy: ["uid_id"]}],
        ["database.create", path, {uid: "bob", id: "alice", uid_id: "bob_alice", id_uid: "alice_bob", timestamp: 123}],
        ["database.delete", ["mutualrequests", {mutual_type: "friend"}, {mutual_id: "r1"}]]
    ]);
});

it("keeps an existing reverse mutual", async () => {
    const backend = {request: vi.fn(async name => name === "database.cursor"
        ? {next: async () => [{key: "reverse"}]} : undefined)};
    await new MutualRequestListener(backend).onUpdate({params: {mutual_type: "friend", mutual_id: "r1"},
        value: {uid: "alice", id: "bob", accepted: true, uid_id: "stale", id_uid: "stale"}});
    expect(backend.request.mock.calls.filter(([name]) => name === "database.create")).toHaveLength(1);
});
