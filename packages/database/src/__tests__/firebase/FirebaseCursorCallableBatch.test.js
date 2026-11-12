import createService from "../../../../../src/__tests__/createService";
import FirebaseBackendClient from "../../../../backend/src/firebase-client/FirebaseBackendClient";
import update from "../../../../backend/src/firebase-server/src/database/callable/update";
import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

const callablePayloads = vi.hoisted(() => []);

vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));
vi.mock("../../../../backend/src/firebase-server/node_modules/firebase-admin/lib/esm/database/index.js", () => ({
    getDatabase: () => ({ref: path => ({toString: () => `https://demo.example.test/${path ?? ""}`})}),
}));
vi.mock("firebase/functions", () => ({
    getFunctions: () => ({}),
    httpsCallable: (_, endpoint) => async payload => {
        expect(endpoint).toBe("database-update");
        callablePayloads.push(payload);
        // Callable request data crosses a JSON transport before the server sees it.
        return {data: await update.run({data: JSON.parse(JSON.stringify(payload))})};
    },
}));

it("sends public cursor checkpoint and structured-path page batches as callable objects", async () => {
    callablePayloads.length = 0;
    const fixture = createFirebase();
    fixture.sdk.once.mockResolvedValueOnce(fixture.snapshot({a: 1}))
        .mockResolvedValueOnce(fixture.snapshot({b: 2}));
    const requests = [];
    vi.stubGlobal("fetch", vi.fn(async (url, request) => {
        requests.push({url, request, changes: JSON.parse(request.body)});
        return {ok: true, status: 200, body: {cancel: vi.fn()}};
    }));
    try {
        const backend = new FirebaseBackendClient({firebase: fixture.firebase});
        const database = createService(FirebaseDatabase, {firebase: fixture.firebase, backend});
        const cursor = database.cursor(["records", {group_id: "one"}, "entry_id"],
            {handle: ({value}) => value * 10});
        expect(await cursor.all(2)).toBe(2);
        expect(requests).toHaveLength(3);
        expect(callablePayloads).toHaveLength(3);
        expect(callablePayloads.every(([, changes]) => changes !== null &&
            Object.getPrototypeOf(changes) === Object.prototype)).toBe(true);
        expect(callablePayloads[1][1]).toEqual({"records/one/a": 10, "records/one/b": 20});
        for (const {url, request} of requests) {
            expect(url.pathname).toBe("/.json");
            expect(request.method).toBe("PATCH");
        }
        const checkpointPath = Object.keys(requests[0].changes)[0];
        expect(checkpointPath).toMatch(/^meta\/_checkpoints\//);
        expect(requests[0].changes[checkpointPath]).toMatchObject({key: "a", count: 0, finished: false});
        expect(requests[1].changes).toEqual({"records/one/a": 10, "records/one/b": 20});
        expect(requests[2].changes[checkpointPath]).toMatchObject({count: 2, finished: true});
    } finally {
        vi.unstubAllGlobals();
    }
});

it("leaves direct FirebaseBackendClient.request Map and object payloads unchanged", async () => {
    callablePayloads.length = 0;
    const fixture = createFirebase();
    const bodies = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, request) => {
        bodies.push(JSON.parse(request.body));
        return {ok: true, status: 200, body: {cancel: vi.fn()}};
    }));
    try {
        const backend = new FirebaseBackendClient({firebase: fixture.firebase});
        const mapBatch = new Map([
            [["posts", {post_id: "one"}, "done"], true],
            ["meta/maintenance", false],
        ]);
        await backend.request("database.update", "", mapBatch);
        const objectBatch = {"posts/two/done": true};
        await backend.request("database.update", "", objectBatch);
        expect(callablePayloads).toEqual([["", mapBatch], ["", objectBatch]]);
        expect(callablePayloads[0][1]).toBe(mapBatch);
        expect(callablePayloads[1][1]).toBe(objectBatch);
        expect(bodies).toEqual([{}, objectBatch]);
    } finally {
        vi.unstubAllGlobals();
    }
});
