vi.mock("../firebase-server/src/common/firebase", () => ({database: {}, messaging: {}}));

import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import onEvents from "../firebase-server/src/database/onEvents";
import onCall from "../firebase-server/src/common/onCall";
import {createActivity} from "../common/handlers/activity";

beforeEach(() => vi.stubEnv("FUNCTIONS_EMULATOR", "false"));
afterEach(() => vi.unstubAllEnvs());

const snapshot = value => ({val: () => value});
const value = {uid: "record-owner", text: "new"};
const previous = {uid: "record-owner", text: "old"};
const params = {post_id: "post"};
const dataFor = name => name === "onUpdate" ? {before: snapshot(previous), after: snapshot(value)} : snapshot(value);

for (const name of ["onCreate", "onUpdate", "onDelete"]) {
    it.each([
        [{authType: "app_user", authId: "actor"}, "actor"],
        [{authType: "app_user"}, undefined],
        [{authType: "admin", authId: "admin"}, "admin"],
        [{authType: "unauthenticated", authId: "unexpected"}, "unexpected"],
        [{authType: "unknown", authId: "unexpected"}, "unexpected"],
        [{}, undefined],
    ])(`${name} exposes the native event actor %j without changing the listener payload`, async (auth, uid) => {
        const backend = new FirebaseServerBackend();
        const callback = vi.fn(async payload => {
            await Promise.resolve();
            expect(await backend.getCurrentUser()).toBe(uid);
            expect(payload).toEqual({value, params, ...(name === "onUpdate" ? {previous} : {})});
            return "result";
        });
        const triggers = onEvents({path: ["posts", "post_id"], [name]: callback});
        const data = dataFor(name);
        const event = {data, params, ...auth};
        expect(await triggers[name].run(event)).toBe("result");
        expect(callback).toHaveBeenCalledTimes(1);
        expect(event).toEqual({data, params, ...auth});
        expect(await backend.getCurrentUser()).toBeUndefined();
    });

    it(`${name} keeps concurrent events and the activity author isolated`, async () => {
        const backend = new FirebaseServerBackend();
        const request = vi.spyOn(backend, "request").mockResolvedValue("activity-key");
        let entered = 0, release;
        const ready = new Promise(resolve => { release = resolve; });
        const triggers = onEvents({path: ["posts", "post_id"], async [name]({params}) {
            if (++entered === 2) release();
            await ready;
            return createActivity(backend, {type: "post.test", details: params.post_id});
        }});
        await Promise.all(["alice", "bob"].map(uid => triggers[name].run({
            data: dataFor(name), params: {post_id: uid}, authType: "app_user", authId: uid,
        })));
        expect(request.mock.calls.map(([, , activity]) => [activity.uid, activity.details]).sort()).toEqual([
            ["alice", "alice"], ["bob", "bob"],
        ]);
        expect(await backend.getCurrentUser()).toBeUndefined();
    });

    it(`${name} clears context after rejection and masks any enclosing callable user`, async () => {
        const backend = new FirebaseServerBackend();
        const failure = new Error("handler failed");
        const trigger = onEvents({path: ["posts", "post_id"], async [name]() {
            expect(await backend.getCurrentUser()).toBeUndefined();
            throw failure;
        }})[name];
        const callable = onCall(async () => {
            expect(await backend.getCurrentUser()).toBe("caller");
            await expect(trigger.run({data: dataFor(name), params, authType: "unknown"})).rejects.toBe(failure);
            expect(await backend.getCurrentUser()).toBe("caller");
        });
        await callable.run({auth: {uid: "caller"}});
        expect(await backend.getCurrentUser()).toBeUndefined();
    });
}

it("writes system activities as uid 0 when the event has no user", async () => {
    const backend = new FirebaseServerBackend();
    const request = vi.spyOn(backend, "request").mockResolvedValue("activity-key");
    await onEvents({path: ["posts", "post_id"], onCreate: () => createActivity(backend)})
        .onCreate.run({data: snapshot(value), params, authType: "unknown"});
    expect(request.mock.calls[0][2].uid).toBe(0);
});
