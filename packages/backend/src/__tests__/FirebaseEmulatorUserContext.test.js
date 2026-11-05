vi.mock("../firebase-server/src/common/firebase", () => ({database: {}, messaging: {}}));

import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";
import onEvents from "../firebase-server/src/database/onEvents";
import {createActivity} from "../common/handlers/activity";

const snapshot = value => ({val: () => value});
const dataFor = (name, value) => name === "onUpdate"
    ? {before: snapshot({uid: "previous-owner"}), after: snapshot(value)}
    : snapshot(value);

beforeEach(() => vi.stubEnv("FUNCTIONS_EMULATOR", "true"));
afterEach(() => vi.unstubAllEnvs());

for (const name of ["onCreate", "onUpdate", "onDelete"]) {
    it(`${name} uses the snapshot owner for an emulator activity`, async () => {
        const backend = new FirebaseServerBackend();
        const request = vi.spyOn(backend, "request").mockResolvedValue("activity-key");
        const value = {uid: "snapshot-owner", text: "record"};
        const callback = vi.fn(async payload => {
            expect(payload.value).toEqual(value);
            if (name === "onUpdate") expect(payload.previous.uid).toBe("previous-owner");
            await Promise.resolve();
            return createActivity(backend, {type: "test"});
        });
        expect(await onEvents({path: ["posts", "post_id"], [name]: callback})[name].run({
            data: dataFor(name, value), params: {post_id: "post"}, authType: "unknown",
        })).toBe("activity-key");
        expect(request.mock.calls[0][2].uid).toBe("snapshot-owner");
        expect(callback).toHaveBeenCalledTimes(1);
        expect(await backend.getCurrentUser()).toBeUndefined();
    });

    it.each(["false", "TRUE", undefined])(`${name} does not use the owner outside explicit emulator mode %j`, async mode => {
        vi.stubEnv("FUNCTIONS_EMULATOR", mode);
        const backend = new FirebaseServerBackend();
        const callback = vi.fn(async () => expect(await backend.getCurrentUser()).toBeUndefined());
        await onEvents({path: ["posts", "post_id"], [name]: callback})[name].run({
            data: dataFor(name, {uid: "owner"}), params: {}, authType: "unknown",
        });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it(`${name} preserves native identity ahead of the owner`, async () => {
        const backend = new FirebaseServerBackend();
        const callback = vi.fn(async () => expect(await backend.getCurrentUser()).toBe("native-actor"));
        await onEvents({path: ["posts", "post_id"], [name]: callback})[name].run({
            data: dataFor(name, {uid: "owner"}), params: {}, authType: "app_user", authId: "native-actor",
        });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it.each([null, 0, false, "text", {}, {uid: ""}, {uid: 0}, {uid: false}, {uid: {id: "owner"}}])(
        `${name} ignores missing or invalid owner in %j`, async value => {
            const backend = new FirebaseServerBackend();
            await onEvents({path: ["posts", "post_id"], async [name]() {
                expect(await backend.getCurrentUser()).toBeUndefined();
            }})[name].run({data: dataFor(name, value), params: {}, authType: "unknown"});
        }
    );

    it(`${name} isolates concurrent substituted users`, async () => {
        const backend = new FirebaseServerBackend();
        const request = vi.spyOn(backend, "request").mockResolvedValue("activity-key");
        let entered = 0, release;
        const ready = new Promise(resolve => { release = resolve; });
        const trigger = onEvents({path: ["posts", "post_id"], async [name]({params}) {
            if (++entered === 2) release();
            await ready;
            await createActivity(backend, {details: params.post_id});
        }})[name];
        await Promise.all(["alice", "bob"].map(uid => trigger.run({
            data: dataFor(name, {uid}), params: {post_id: uid}, authType: "unknown",
        })));
        expect(request.mock.calls.map(([, , activity]) => [activity.uid, activity.details]).sort()).toEqual([
            ["alice", "alice"], ["bob", "bob"],
        ]);
        expect(await backend.getCurrentUser()).toBeUndefined();
    });
}
