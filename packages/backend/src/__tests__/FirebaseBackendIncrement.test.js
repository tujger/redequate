import update from "../firebase-server/src/database/update";
import {increment} from "firebase/database";

vi.mock("../firebase-server/node_modules/firebase-admin/lib/esm/database/index.js", () => ({
    getDatabase: () => ({ref: path => ({toString: () => `https://demo.example.test/${path ?? ""}`})}),
}));

const marker = increment(2);
let fetchMock;
beforeEach(() => {
    fetchMock = vi.fn(async () => ({ok: true, status: 200, json: async () => 7, headers: new Headers()}));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const path = ["_counters", {id: "total"}, "posts"];

it("sends one unconditional native increment PUT and returns the resolved value", async () => {
    expect(await update.run({data: [path, marker]})).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe("/_counters/total/posts.json");
    expect(request).toMatchObject({method: "PUT", body: JSON.stringify(marker)});
    expect(request.headers).not.toHaveProperty("If-Match");
    expect(request.headers).not.toHaveProperty("X-Firebase-ETag");
});

it("preserves nested increment markers in ordinary patches", async () => {
    expect(await update.run({data: [["_counters", {id: "total"}], {posts: marker}]})).toBeNull();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "PATCH", body: JSON.stringify({posts: marker})});
});

it("retains conditional replacement behavior for increment values", async () => {
    expect(await update.run({data: [path, marker, {mode: "replace", etag: '"revision"'}]})).toEqual({committed: true, value: 7});
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: "PUT", headers: {"If-Match": '"revision"'}});
});

it("rejects malformed explicit increments and root increments without writing", async () => {
    await expect(update.run({data: [path, {}, {mode: "increment"}]})).rejects.toMatchObject({code: "invalid-argument"});
    await expect(update.run({data: ["", marker]})).rejects.toMatchObject({code: "invalid-argument"});
    expect(fetchMock).not.toHaveBeenCalled();
});

it("forwards authentication and preserves permission errors", async () => {
    fetchMock.mockResolvedValueOnce({ok: false, status: 403, body: {cancel: vi.fn()}});
    await expect(update.run({data: [path, marker], auth: {uid: "u1"}, rawRequest: {headers: {authorization: "Bearer test-token"}}}))
        .rejects.toMatchObject({code: "permission-denied"});
    expect(fetchMock.mock.calls[0][0].searchParams.get("auth")).toBe("test-token");
});
