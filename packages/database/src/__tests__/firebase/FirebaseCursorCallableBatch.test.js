import FirebaseBackendClient from "../../../../backend/src/firebase-client/FirebaseBackendClient";
import update from "../../../../backend/src/firebase-server/src/database/callable/update";
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
