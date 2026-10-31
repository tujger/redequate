import {continueRebuild, resumePendingRebuilds} from "../local/rebuildWorker";

const {portion} = vi.hoisted(() => ({portion: vi.fn()}));
vi.mock("../common/handlers", () => ({
    activity: class {
        constructor() {
            this.path = ["activity", "activity_id"];
            this.derivedCheckpoints = [{path: ["_activity"], checkpointPath: ["_rebuild", {job_id: "activity"}]}];
        }
        rebuildPortion() { return portion(); }
        onRebuildDerivedData() { return portion(); }
    },
}));
const path = ["activity", "activity_id"];

beforeEach(() => portion.mockReset());

it("continues remaining portions in a managed Local worker", async () => {
    portion.mockResolvedValueOnce({status: {rebuilding: true}, conflict: false})
        .mockResolvedValueOnce({status: {rebuilding: false}, conflict: false});
    await continueRebuild({request: vi.fn()}, path);
    expect(portion).toHaveBeenCalledTimes(2);
});

it("resumes a persisted checkpoint after creating a new backend", async () => {
    const backend = {request: vi.fn().mockResolvedValue({run: "old", revision: 1, cursor: "one"})};
    portion.mockResolvedValue({status: {rebuilding: false}, conflict: false});
    resumePendingRebuilds(backend);
    await vi.waitFor(() => expect(portion).toHaveBeenCalledOnce());
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.read", ["_rebuild", {job_id: "activity"}]);
});
