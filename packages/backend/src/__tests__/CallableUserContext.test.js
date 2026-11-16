vi.mock("../firebase-server/src/common/firebase", () => ({database: {}, messaging: {}}));

import FirebaseBackendServer from "../firebase-server/src/FirebaseBackendServer";
import backend from "../firebase-server/src/backend";
import onCall from "../firebase-server/src/common/onCall";

it("isolates concurrent callable users and restores context after success and failure", async () => {
    const server = new FirebaseBackendServer();
    const seen = [];
    const anonymous = onCall(async () => {
        expect(await server.getCurrentUser()).toBeUndefined();
    });
    // Force both callers to enter before either reads its identity.
    let entered = 0;
    let release;
    const bothEntered = new Promise(resolve => { release = resolve; });
    const endpoint = onCall(async request => {
        if (++entered === 2) release();
        await bothEntered;
        const uid = request.auth.uid;
        expect(await server.getCurrentUser()).toBe(uid);
        await anonymous.run({});
        expect(await server.getCurrentUser()).toBe(uid);
        seen.push(uid);
    });
    await expect(server.getCurrentUser()).resolves.toBeUndefined();
    await Promise.all(["alice", "bob"].map(uid => endpoint.run({auth: {uid}})));
    expect(seen.sort()).toEqual(["alice", "bob"]);
    await expect(server.getCurrentUser()).resolves.toBeUndefined();
    const failure = new Error("failed");
    const failing = onCall(async () => {
        expect(await server.getCurrentUser()).toBe("failed-user");
        throw failure;
    });
    await expect(failing.run({auth: {uid: "failed-user"}})).rejects.toBe(failure);
    await expect(server.getCurrentUser()).resolves.toBeUndefined();
    // A standalone database trigger has no caller context, even with a linked Auth.
    server.setAuth({resolveCurrentUser: async () => ({id: "client"})});
    await expect(server.getCurrentUser()).resolves.toBeUndefined();
});

it("wraps callable execution with the shared backend identity", async () => {
    const endpoint = onCall(async () => backend.getCurrentUser());
    expect(await endpoint.run({auth: {uid: "caller"}})).toBe("caller");
    expect(await endpoint.run({})).toBeUndefined();
    expect(await backend.getCurrentUser()).toBeUndefined();
});

it("preserves callable options and propagates handler errors", async () => {
    const failure = new Error("callable failed");
    const endpoint = onCall({cors: true}, async () => {
        expect(await backend.getCurrentUser()).toBe("caller");
        throw failure;
    });
    await expect(endpoint.run({auth: {uid: "caller"}})).rejects.toBe(failure);
    expect(await backend.getCurrentUser()).toBeUndefined();
});

it("routes server requests with injected Admin SDK factories", async () => {
    const value = {uid: "author"};
    const ref = {get: vi.fn(async () => ({val: () => value}))};
    const database = {ref: vi.fn(() => ref)};
    const increment = vi.fn(n => ({increment: n}));
    const server = new FirebaseBackendServer(() => database, increment);
    await expect(server.request("database.read", ["posts", {post_id: "post"}])).resolves.toBe(value);
    expect(database.ref).toHaveBeenCalledExactlyOnceWith("posts/post");
    expect(server.increment(2)).toEqual({increment: 2});
    await expect(server.request("unknown.operation")).rejects.toMatchObject({code: "backend/not-implemented"});
});

it("forwards callable response arguments and preserves return values", async () => {
    const response = {};
    const endpoint = onCall((request, actualResponse) => {
        expect(actualResponse).toBe(response);
        return request.data;
    });
    expect(await endpoint.run({data: "value", auth: {uid: "caller"}}, response)).toBe("value");
    expect(await backend.getCurrentUser()).toBeUndefined();
});
