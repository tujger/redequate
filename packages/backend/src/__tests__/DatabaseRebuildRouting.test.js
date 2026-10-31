import rebuild from "../common/rebuild";
import localRequests from "../local/requestHandlers";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import LocalBackend from "../local/LocalBackend";
import callable from "../firebase-server/src/database/callable/rebuild";

const {run, getDatabase, routes} = vi.hoisted(() => ({run: vi.fn(), getDatabase: vi.fn(), routes: {ambiguous: false}}));

vi.mock("../common/handlers", () => ({
    activity: class {
        constructor(backend) {
            this.backend = backend;
            this.path = ["activity", "activity_id"];
            if (routes.ambiguous) this.derivedCheckpoints = [{}, {}];
        }
        onRebuildDerivedData(...args) { return run(this.backend, ...args); }
    },
    post: class {
        constructor() { this.path = ["posts", "post_id"]; }
    },
}));

vi.mock("../firebase-server/node_modules/firebase-admin/lib/esm/database/index.js", () => ({
    getDatabase, ServerValue: {TIMESTAMP: {}},
}));

const path = ["activity", "activity_id"];
const database = {ref: vi.fn(() => ({child: vi.fn(() => ({get: vi.fn(async () => ({val: () => "admin"}))}))}))};

beforeEach(() => {
    run.mockReset().mockResolvedValue({rebuilding: false});
    routes.ambiguous = false;
    getDatabase.mockReset().mockReturnValue(database);
    database.ref.mockClear();
});

it("rejects a rebuild path shared by several derived stores", () => {
    routes.ambiguous = true;
    expect(() => rebuild({}, path)).toThrow("one derived store");
});

it("routes Local and Firebase server requests to the optional handler without arguments", async () => {
    const local = new LocalBackend({storageId: "rebuild-routing"});
    expect(await local.request("database.rebuild", path)).toEqual({rebuilding: false});
    expect(run).toHaveBeenLastCalledWith(local);
    const server = new FirebaseServerBackend(getDatabase);
    expect(await server.request("database.rebuild", path)).toEqual({rebuilding: false});
    expect(run).toHaveBeenLastCalledWith(server);
    expect(run).toHaveBeenCalledTimes(2);
});

it("rejects extra options and paths without a rebuild method", async () => {
    const backend = {};
    expect(() => localRequests["database.rebuild"]({args: [path, {}], backend})).toThrow("Expected (path).");
    await expect(new FirebaseServerBackend(getDatabase).request("database.rebuild", path, {}))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    expect(() => rebuild(backend, ["posts", "post_id"])).toThrow();
    expect(() => rebuild(backend, ["activity", "different_id"])).toThrow();
    expect(run).not.toHaveBeenCalled();
});

it("authorizes the Firebase callable before routing", async () => {
    await expect(callable.run({data: path})).rejects.toMatchObject({code: "unauthenticated"});
    expect(getDatabase).not.toHaveBeenCalled();
    database.ref.mockImplementationOnce(() => ({child: () => ({get: async () => ({val: () => "user"})})}));
    await expect(callable.run({data: path, auth: {uid: "u1"}})).rejects.toMatchObject({code: "permission-denied"});
    expect(run).not.toHaveBeenCalled();
    expect(await callable.run({data: path, auth: {uid: "u1"}})).toEqual({rebuilding: false});
    expect(database.ref).toHaveBeenCalledWith("roles");
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]).toHaveLength(1);
});
