import FirebaseBackendClient from "../firebase-client/FirebaseBackendClient";
import update from "../firebase-server/src/database/callable/update";
import {increment} from "firebase/database";

vi.mock("../firebase-server/node_modules/firebase-admin/lib/esm/database/index.js", () => ({
    getDatabase: () => ({ref: path => ({toString: () => `https://demo.example.test/${path ?? ""}`})}),
}));

vi.mock("firebase/functions", () => ({
    getFunctions: () => ({}),
    httpsCallable: (_, endpoint) => async data => {
        expect(endpoint).toBe("database-update");
        return {data: await update.run({data})};
    },
}));

const backend = new FirebaseBackendClient({firebase: {app: {}}});
const marker = increment(2);
let fetchMock;
beforeEach(() => {
    fetchMock = vi.fn(async () => ({ok: true, status: 200, json: async () => 7, headers: new Headers()}));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const path = ["_counters", {id: "total"}, "posts"];

it("sends a native increment through one root PATCH without changing the server handler", async () => {
    expect(await backend.request("database.update", path, marker)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/.json");
    expect(request).toMatchObject({method: "PATCH", body: JSON.stringify({"_counters/total/posts": marker})});
    expect(request.headers).not.toHaveProperty("If-Match");
    expect(request.headers).not.toHaveProperty("X-Firebase-ETag");
});

it("preserves nested increment markers in ordinary patches", async () => {
    expect(await backend.request("database.update", ["_counters", {id: "total"}], {posts: marker}, {mode: "patch"})).toBeNull();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "PATCH", body: JSON.stringify({posts: marker})});
});

it("retains conditional replacement behavior for increment values", async () => {
    expect(await backend.request("database.update", path, marker, {mode: "replace", etag: '"revision"'})).toEqual({committed: true, value: 7});
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "PUT", headers: {"If-Match": '"revision"'}});
});

it("rejects the removed increment mode without writing", async () => {
    await expect(update.run({data: [path, marker, {mode: "increment"}]})).rejects.toMatchObject({code: "invalid-argument"});
    expect(fetchMock).not.toHaveBeenCalled();
});

it("forwards authentication and preserves permission errors", async () => {
    fetchMock.mockResolvedValueOnce({ok: false, status: 403, body: {cancel: vi.fn()}});
    await expect(update.run({data: ["", {"_counters/total/posts": marker}], auth: {uid: "u1"}, rawRequest: {headers: {authorization: "Bearer test-token"}}}))
        .rejects.toMatchObject({code: "permission-denied"});
    expect(fetchMock.mock.calls[0][0].searchParams.get("auth")).toBe("test-token");
});


it.each([0, false, null, [1, 2], {complete: true}])("writes a complete value %j without inspecting its contents", async value => {
    expect(await backend.request("database.update", path, value)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "PATCH", body: JSON.stringify({"_counters/total/posts": value})});
});

it("uses PATCH for root batches by default", async () => {
    const batch = {"_counters/total/posts": marker, "meta/maintenance": false};
    expect(await backend.request("database.update", "", batch)).toBeNull();
    const [url, request] = fetchMock.mock.calls[0];
    expect(request).toMatchObject({method: "PATCH", body: JSON.stringify(batch)});
    expect(url.searchParams.get("print")).toBe("silent");
});

it("preserves reads and conditional replacement conflicts", async () => {
    fetchMock.mockResolvedValueOnce({ok: true, status: 200, json: async () => 3, headers: new Headers({etag: '"current"'})});
    expect(await backend.request("database.update", path, null, {mode: "read"})).toEqual({value: 3, etag: '"current"'});
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "GET", headers: {"X-Firebase-ETag": "true"}});
    fetchMock.mockResolvedValueOnce({ok: false, status: 412, json: async () => 4, headers: new Headers({etag: '"fresh"'})});
    expect(await backend.request("database.update", path, 5, {mode: "replace", etag: '"current"'}))
        .toEqual({committed: false, value: 4, etag: '"fresh"'});
});
