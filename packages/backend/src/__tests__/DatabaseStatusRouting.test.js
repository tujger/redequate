import status from "../common/status";
import localRequests from "../local/requestHandlers";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import LocalBackend from "../local/LocalBackend";
import callable from "../firebase-server/src/database/callable/status";

const {getDatabase} = vi.hoisted(() => ({getDatabase: vi.fn()}));

vi.mock("../common/handlers", () => ({
    activity: class {
        constructor() {
            this.path = ["activity", "activity_id"];
            this.derivedCheckpoints = [
                {path: ["_activity"], checkpointPath: ["_rebuild", {job_id: "activity"}]},
                {path: ["_activity_archive"], checkpointPath: ["_rebuild", {job_id: "archive"}]},
            ];
        }
    },
    post: class { constructor() { this.path = ["posts", "post_id"]; } },
}));

vi.mock("../firebase-server/node_modules/firebase-admin/lib/esm/database/index.js", () => ({
    getDatabase, ServerValue: {TIMESTAMP: {}},
}));

const handler = ["activity", "activity_id"];
const checkpoints = new Map();
const read = vi.fn(async path => checkpoints.get(JSON.stringify(path)) ?? null);
const database = {ref: vi.fn(path => {
    if (path === "roles") return {child: () => ({get: async () => ({val: () => "admin"})})};
    return {get: async () => ({val: () => read(path)})};
})};

beforeEach(() => {
    checkpoints.clear();
    read.mockClear();
    getDatabase.mockReset().mockReturnValue(database);
    database.ref.mockClear();
});

it("reads only the selected derived checkpoint without changing either checkpoint", async () => {
    const backend = {request: vi.fn((name, path) => {
        expect(name).toBe("database.read");
        return read(path);
    })};
    const first = {run: "first", revision: 2, cursor: {id: "a"}};
    const second = {run: "second", revision: 5, cursor: null};
    checkpoints.set(JSON.stringify(["_rebuild", {job_id: "activity"}]), first);
    checkpoints.set(JSON.stringify(["_rebuild", {job_id: "archive"}]), second);
    expect(await status(backend, handler, ["_activity"])).toEqual({rebuilding: true, ...first});
    expect(await status(backend, handler, ["_activity_archive"])).toEqual({rebuilding: true, ...second});
    expect(backend.request.mock.calls).toEqual([
        ["database.read", ["_rebuild", {job_id: "activity"}]],
        ["database.read", ["_rebuild", {job_id: "archive"}]],
    ]);
    expect(checkpoints.get(JSON.stringify(["_rebuild", {job_id: "activity"}]))).toBe(first);
    expect(checkpoints.get(JSON.stringify(["_rebuild", {job_id: "archive"}]))).toBe(second);
});

it("returns false when the selected checkpoint is absent", async () => {
    const backend = {request: vi.fn((name, path) => read(path))};
    expect(await status(backend, handler, ["_activity"])).toEqual({rebuilding: false});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.read", ["_rebuild", {job_id: "activity"}]);
});

it("rejects unknown handlers, derived paths, and malformed requests before reading", async () => {
    const backend = {request: vi.fn()};
    for (const [path, derivedPath] of [
        [["missing", "id"], ["_activity"]],
        [["posts", "post_id"], ["_activity"]],
        [handler, ["_rebuild", {job_id: "activity"}]],
        [handler, ["_activity", "other"]],
    ]) await expect(status(backend, path, derivedPath)).rejects.toMatchObject({code: "backend/not-implemented"});
    for (const [path, derivedPath] of [["", ["_activity"]], [handler, ""], [handler, [{}]], [handler, undefined]]) {
        await expect(status(backend, path, derivedPath)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(backend.request).not.toHaveBeenCalled();
});

it("requires two paths in Local and Firebase server routing", async () => {
    expect(() => localRequests["database.status"]({args: [handler], backend: {}})).toThrow();
    const server = new FirebaseServerBackend(getDatabase);
    await expect(server.request("database.status", handler)).rejects.toMatchObject({code: "database/invalid-argument"});
    await expect(server.request("database.status", handler, ["_activity"], "extra"))
        .rejects.toMatchObject({code: "database/invalid-argument"});
    const local = new LocalBackend({storageId: "status-routing"});
    const localRead = vi.spyOn(localRequests, "database.read").mockImplementation(({args}) => read(args[0]));
    expect(await local.request("database.status", handler, ["_activity"])).toEqual({rebuilding: false});
    localRead.mockRestore();
    expect(await server.request("database.status", handler, ["_activity"])).toEqual({rebuilding: false});
    expect(read).toHaveBeenCalledTimes(2);
});

it("authorizes the Firebase callable before accessing checkpoints", async () => {
    await expect(callable.run({data: [handler, ["_activity"]]})).rejects.toMatchObject({code: "unauthenticated"});
    expect(getDatabase).not.toHaveBeenCalled();
    database.ref.mockImplementationOnce(() => ({child: () => ({get: async () => ({val: () => "user"})})}));
    await expect(callable.run({data: [handler, ["_activity"]], auth: {uid: "u1"}}))
        .rejects.toMatchObject({code: "permission-denied"});
    expect(read).not.toHaveBeenCalled();
    await expect(callable.run({data: [handler], auth: {uid: "u1"}}))
        .rejects.toMatchObject({code: "invalid-argument"});
    expect(await callable.run({data: [handler, ["_activity"]], auth: {uid: "u1"}}))
        .toEqual({rebuilding: false});
    expect(database.ref).toHaveBeenCalledWith("roles");
});
