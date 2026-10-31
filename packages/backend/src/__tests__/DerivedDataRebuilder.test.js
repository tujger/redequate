import DerivedDataRebuilder from "../common/DerivedDataRebuilder";

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};

const fixture = (source = [1, 2, 3], size = 2) => {
    let checkpoint = null, version = 0;
    const writes = [];
    const backend = {request: vi.fn(async (name, path, value, options) => {
        expect(name).toBe("database.update");
        expect(path).toEqual(["_rebuild", {job_id: "test"}]);
        if (options.mode === "read") return {value: checkpoint, etag: String(version)};
        if (options.etag !== String(version)) return {committed: false, value: checkpoint, etag: String(version)};
        checkpoint = value;
        version++;
        writes.push(value);
        return {committed: true, value};
    })};
    class Rebuilder extends DerivedDataRebuilder {
        constructor() { super(["source", "source_id"], backend, ["_rebuild", {job_id: "test"}], size, ["_derived"]); }
        async readBatch(cursor, limit) {
            const start = cursor ?? 0;
            const items = source.slice(start, start + limit);
            const next = start + items.length;
            return {items, cursor: next, done: next >= source.length};
        }
        async applyBatch(items, state) { this.applied.push({items: [...items], run: state.run}); }
        applied = [];
    }
    return {Rebuilder, backend, writes, checkpoint: () => checkpoint,
        changeCheckpoint: value => { checkpoint = value; version++; }};
};

it("declares its derived store and checkpoint for status lookup", () => {
    const {Rebuilder} = fixture();
    expect(new Rebuilder().derivedCheckpoints).toEqual([
        {path: ["_derived"], checkpointPath: ["_rebuild", {job_id: "test"}]},
    ]);
});

it("completes a final short portion and conditionally deletes the checkpoint", async () => {
    const {Rebuilder, writes, checkpoint} = fixture();
    const runner = new Rebuilder();
    expect(await runner.onRebuildDerivedData()).toMatchObject({rebuilding: true, revision: 1, cursor: 2});
    expect(runner.applied.map(x => x.items)).toEqual([[1, 2]]);
    expect(await runner.onRebuildDerivedData()).toEqual({rebuilding: false});
    expect(runner.applied.map(x => x.items)).toEqual([[1, 2], [3]]);
    expect(writes.map(x => x?.revision ?? null)).toEqual([0, 1, null]);
    expect(checkpoint()).toBeNull();
    expect(await runner.onRebuildDerivedData()).toMatchObject({rebuilding: true, revision: 1});
    expect(runner.applied.map(x => x.items)).toEqual([[1, 2], [3], [1, 2]]);
});

it("finishes an empty source without calling applyBatch", async () => {
    const {Rebuilder, writes} = fixture([]);
    const runner = new Rebuilder();
    expect(await runner.onRebuildDerivedData()).toEqual({rebuilding: false});
    expect(runner.applied).toEqual([]);
    expect(writes.at(-1)).toBeNull();
});

it("retains the checkpoint on failure and replays the portion on resume", async () => {
    const {Rebuilder, checkpoint} = fixture();
    const failed = new Rebuilder();
    failed.applyBatch = vi.fn().mockRejectedValueOnce(new Error("write failed"));
    await expect(failed.onRebuildDerivedData()).rejects.toThrow("write failed");
    expect(checkpoint()).toMatchObject({revision: 0, cursor: null});
    const resumed = new Rebuilder();
    expect(await resumed.onRebuildDerivedData()).toMatchObject({rebuilding: true, revision: 1});
    expect(await resumed.onRebuildDerivedData()).toEqual({rebuilding: false});
    expect(resumed.applied.map(x => x.items)).toEqual([[1, 2], [3]]);
});

it("resumes the existing run without replacing its checkpoint", async () => {
    const {Rebuilder, checkpoint} = fixture();
    const first = new Rebuilder();
    first.applyBatch = vi.fn().mockRejectedValueOnce(new Error("stop"));
    await expect(first.onRebuildDerivedData()).rejects.toThrow();
    const oldRun = checkpoint().run;
    const resumed = new Rebuilder();
    expect(await resumed.onRebuildDerivedData()).toMatchObject({rebuilding: true, revision: 1});
    expect(await resumed.onRebuildDerivedData()).toEqual({rebuilding: false});
    expect(resumed.applied[0].run).toBe(oldRun);
});

it("lets two runners process a portion but only one advance its checkpoint", async () => {
    const {Rebuilder, backend, writes} = fixture([1], 1);
    const a = new Rebuilder(), b = new Rebuilder();
    const gate = deferred(), arrived = deferred();
    let count = 0;
    for (const runner of [a, b]) runner.applyBatch = async () => {
        if (++count === 2) arrived.resolve();
        await gate.promise;
    };
    // Establish one active run before both workers resume it.
    a.applyBatch = vi.fn().mockRejectedValueOnce(new Error("pause"));
    await expect(a.onRebuildDerivedData()).rejects.toThrow("pause");
    a.applyBatch = async () => { if (++count === 2) arrived.resolve(); await gate.promise; };
    const results = [a.rebuildPortion(), b.rebuildPortion()];
    await arrived.promise;
    gate.resolve();
    expect((await Promise.all(results)).map(result => result.conflict).sort()).toEqual([false, true]);
    expect(writes.filter(x => x === null)).toHaveLength(1);
    expect(backend.request.mock.calls.filter(([, , , options]) => options.mode === "replace" && options.etag === "1")).toHaveLength(2);
});

it("lets only one runner create a missing checkpoint", async () => {
    const {Rebuilder, backend, writes} = fixture([1], 1);
    const a = new Rebuilder(), b = new Rebuilder();
    const gate = deferred(), arrived = deferred();
    const request = backend.request.getMockImplementation();
    let reads = 0;
    backend.request.mockImplementation(async (...args) => {
        if (args[3]?.mode === "read" && ++reads <= 2) {
            const snapshot = await request(...args);
            if (reads === 2) arrived.resolve();
            await gate.promise;
            return snapshot;
        }
        return request(...args);
    });
    const results = [a.rebuildPortion(), b.rebuildPortion()];
    await arrived.promise;
    gate.resolve();
    expect((await Promise.all(results)).map(result => result.conflict).sort()).toEqual([false, true]);
    expect(writes.map(value => value?.revision ?? null)).toEqual([0, null]);
});

it("stops without overwriting a checkpoint changed during a portion", async () => {
    const {Rebuilder, checkpoint, changeCheckpoint} = fixture([1], 1);
    const runner = new Rebuilder();
    runner.applyBatch = async () => changeCheckpoint({run: "other", revision: 5, cursor: 10});
    expect((await runner.rebuildPortion()).conflict).toBe(true);
    expect(checkpoint()).toEqual({run: "other", revision: 5, cursor: 10});
});

it("stops if another runner changes only the cursor before the portion", async () => {
    const {Rebuilder, checkpoint, changeCheckpoint, backend} = fixture([1], 1);
    const runner = new Rebuilder();
    const request = backend.request.getMockImplementation();
    let reads = 0;
    backend.request.mockImplementation(async (...args) => {
        const result = await request(...args);
        if (args[3]?.mode === "read" && ++reads === 2) {
            changeCheckpoint({...checkpoint(), cursor: 5});
            return {...result, value: checkpoint()};
        }
        return result;
    });
    expect((await runner.rebuildPortion()).conflict).toBe(true);
    expect(runner.applied).toEqual([]);
    expect(checkpoint().cursor).toBe(5);
});
