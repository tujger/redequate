import {knownCounterFailure} from "./knownCounterFailure";
import {vi} from "vitest";
import counterControl from "../../controllers/counterControl";

// Shared contract: run against IndexedDB and the real Firebase RTDB emulator.
export function counterScenarios(createDatabases, {local = false} = {}) {
    let database, other;
    const path = [{id: "audit-post"}, "like"];
    beforeEach(async () => {
        [database, other] = createDatabases();
        if (local) await database.read(["_counters"]);
    });
    const stored = () => counterControl({database, path});
    const seed = value => database.update(["_counters", ...path], () => value);

    const operations = [
        ["increase", {increase: 2}, initial => Math.max(initial ?? 0, 0) + 2],
        ["increment positive", {increment: 2}, initial => Math.max(initial ?? 0, 0) + 2],
        ["decrease", {decrease: 2}, initial => Math.max((initial ?? 0) - 2, 0) || null],
        ["replace", {value: 7}, () => 7],
        ["increase zero", {increase: 0}, initial => initial > 0 ? initial : null],
        ["increment zero", {increment: 0}, initial => initial > 0 ? initial : null],
        ["decrease zero", {decrease: 0}, initial => initial > 0 ? initial : null],
    ];
    for (const initial of [undefined, 0, 1, 5, -3]) {
        for (const [name, operation, expected] of operations) {
            it(`${name} from ${initial}: return value matches persisted value`, async () => {
                if (initial !== undefined) await seed(initial);
                const result = await counterControl({database, path, ...operation});
                expect(result).toBe(expected(initial));
                expect(await stored()).toBe(result === null ? undefined : result);
            });
        }
        const negativeIncrement = initial === undefined || initial <= 0 ? knownCounterFailure : it;
        negativeIncrement(`increment -2 from ${initial} never stores a negative count [C1 for empty/nonpositive]`, async () => {
            if (initial !== undefined) await seed(initial);
            const result = await counterControl({database, path, increment: -2});
            expect(await stored()).toBe(result === null ? undefined : result);
            expect(result).toBe(initial > 2 ? initial - 2 : null);
        });
        const reset = initial > 0 ? knownCounterFailure : it;
        reset(`value 0 from ${initial} clears the counter [C2 for positive]`, async () => {
            if (initial !== undefined) await seed(initial);
            const result = await counterControl({database, path, value: 0});
            expect(await stored()).toBe(result === null ? undefined : result);
            expect(result).toBeNull();
        });
    }

    const paths = [
        ["string", "audit-user/mutual/friend"],
        ["literal array", ["audit-post", "replied"]],
        ["post id", [{id: "audit-post"}, "like"]],
        ["post_id", [{post_id: "audit-post"}, "dislike"]],
        ["subscribers", [{id: "audit-user"}, "mutual", {mutual_type: "following_s"}]],
        ["subscriptions", [{id: "audit-user"}, "mutual", {mutual_type: "friend"}]],
        ["requests", [{id: "audit-user"}, "mutualrequests", {typeId: "friend", _: true}]],
        ["profile posts", [{id: "audit-user"}, "mutualstamps", {_my: "_my"}]],
    ];
    for (const [name, address] of paths) {
        if (local && ["string", "literal array", "post_id"].includes(name)) {
            it(`${name} path requires a declared indexed address on Local`, async () => {
                await expect(counterControl({database, path: address})).rejects.toMatchObject({code: "database/invalid-argument"});
                await expect(counterControl({database, path: address, increment: 1})).rejects.toMatchObject({code: "database/invalid-argument"});
            });
            continue;
        }
        it(`${name} path: initial snapshot, writes, zero, sibling isolation and unsubscribe`, async () => {
            const before = structuredClone(address);
            const changes = vi.fn();
            const stop = counterControl({database, path: address, onchange: changes});
            try {
                await vi.waitFor(() => expect(changes).toHaveBeenCalledWith(undefined));
                for (const [operation, expected] of [[{increment: 2}, 2], [{decrease: 1}, 1], [{decrease: 1}, undefined]]) {
                    await counterControl({database: other, path: address, ...operation});
                    await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith(expected));
                    expect(await counterControl({database, path: address})).toBe(expected);
                }
                const calls = changes.mock.calls.length;
                await counterControl({database: other, path: [{id: "unrelated"}, "like"], increment: 1});
                expect(changes).toHaveBeenCalledTimes(calls);
                stop(); stop();
                await counterControl({database: other, path: address, increment: 1});
                expect(await counterControl({database, path: address})).toBe(1);
                expect(changes).toHaveBeenCalledTimes(calls);
                expect(address).toEqual(before);
            } finally { stop(); }
        });
    }

    it("rejects a missing counter path before accessing a provider", () => {
        expect(() => counterControl({database, increment: 1})).toThrow("Path is not defined");
    });
    it("prioritizes a supplied observer over mutation options", async () => {
        await seed(3);
        const changes = vi.fn();
        const stop = counterControl({database, path, onchange: changes, increment: 10});
        try {
            await vi.waitFor(() => expect(changes).toHaveBeenCalledWith(3));
            expect(await stored()).toBe(3);
        } finally { stop(); }
    });

    it("commits concurrent increments/decrements from two instances without lost writes", async () => {
        // Exercise real CAS retries without random backoff dominating the unit test.
        if (local) vi.spyOn(Math, "random").mockReturnValue(0);
        const changes = vi.fn();
        const stop = counterControl({database, path, onchange: changes});
        try {
            await vi.waitFor(() => expect(changes).toHaveBeenCalledWith(undefined));
            await Promise.all(Array.from({length: 20}, (_, i) => counterControl({database: i % 2 ? database : other, path, increment: 1})));
            expect(await stored()).toBe(20);
            await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith(20));
            await Promise.all(Array.from({length: 12}, (_, i) => counterControl({database: i % 2 ? database : other, path, increment: -1})));
            expect(await stored()).toBe(8);
            await vi.waitFor(() => expect(changes).toHaveBeenLastCalledWith(8));
        } finally { stop(); }
    });
}
