import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import {runRebuildTask} from "../firebase-server/src/database/rebuildWorker";

const {enqueue, portion} = vi.hoisted(() => ({enqueue: vi.fn(), portion: vi.fn()}));
vi.mock("../firebase-server/node_modules/firebase-admin/lib/esm/functions/index.js", () => ({getFunctions: () => ({taskQueue: name => {
    if (name !== "database-rebuildWorker") throw new Error("Wrong queue");
    return {enqueue};
}})}));
vi.mock("../common/handlers", () => ({
    activity: class {
        constructor() { this.path = ["activity", "activity_id"]; this.derivedCheckpoints = [{path: ["_activity"], checkpointPath: ["_rebuild", {job_id: "activity"}]}]; }
        rebuildPortion(...args) { return portion(...args); }
        onRebuildDerivedData() { return portion().then(result => result.status); }
    },
}));

const path = ["activity", "activity_id"];
const state = {rebuilding: true, run: "run-1", revision: 1, cursor: "one"};
const later = {rebuilding: true, run: "run-1", revision: 2, cursor: "two"};
const backend = {request: vi.fn()};

beforeEach(() => { enqueue.mockReset().mockResolvedValue(undefined); portion.mockReset(); });

it("waits for durable enqueue before resolving the server request", async () => {
    let release;
    enqueue.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    portion.mockResolvedValue({status: state, conflict: false});
    const request = new FirebaseServerBackend(() => ({})).request("database.rebuild", path);
    let settled = false;
    request.then(() => { settled = true; });
    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    release();
    expect(await request).toEqual(state);
    expect(enqueue).toHaveBeenCalledWith({path, expected: state});
});

it("runs one worker portion and awaits its successor enqueue", async () => {
    portion.mockResolvedValue({status: later, conflict: false});
    expect(await runRebuildTask({path, expected: state}, backend)).toEqual(later);
    expect(portion).toHaveBeenCalledExactlyOnceWith(state);
    expect(enqueue).toHaveBeenCalledExactlyOnceWith({path, expected: later});
});

it("repairs an enqueue failure on retry without reapplying the portion", async () => {
    portion.mockResolvedValue({status: later, conflict: false});
    enqueue.mockRejectedValueOnce(new Error("queue unavailable"));
    await expect(runRebuildTask({path, expected: state}, backend)).rejects.toThrow("queue unavailable");
    portion.mockResolvedValue({status: later, conflict: true});
    expect(await runRebuildTask({path, expected: state}, backend)).toEqual(later);
    expect(enqueue).toHaveBeenCalledTimes(2);
});

it("stops on an unrelated CAS conflict and does not queue another task", async () => {
    const other = {rebuilding: true, run: "another", revision: 7, cursor: "x"};
    portion.mockResolvedValue({status: other, conflict: true});
    expect(await runRebuildTask({path, expected: state}, backend)).toEqual(other);
    expect(enqueue).not.toHaveBeenCalled();
});

it("does not enqueue after completion in the first portion", async () => {
    portion.mockResolvedValue({status: {rebuilding: false}, conflict: false});
    expect(await new FirebaseServerBackend(() => ({})).request("database.rebuild", path)).toEqual({rebuilding: false});
    expect(enqueue).not.toHaveBeenCalled();
});
