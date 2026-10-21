import {key as pushKey, milliseconds} from "firebase-key";

/** Behavioral cases shared by the Local unit runner and the Firebase emulator runner. */
export function databaseContract(makeProvider) {
    let provider;
    beforeEach(() => { provider = makeProvider(); });

    const keys = async (options = {}, size = 2) => {
        const cursor = provider.db.cursor(provider.path, options);
        const result = [];
        for (let page = 0; !cursor.position.finished && page < 30; page++) {
            result.push(...await cursor.next(size));
        }
        expect(cursor.position.finished).toBe(true);
        expect(cursor.count).toBe(result.length);
        expect(cursor.position.index).toBe(result.length - 1);
        expect(cursor.position.key).toBe(result.at(-1)?.key);
        expect(await cursor.next()).toEqual([]);
        return result.map(entry => entry.key);
    };

    it("creates records without an implicit timestamp and preserves supplied keys and fields", async () => {
        const value = {label: "first"};
        let callbackKey;
        const firstKey = await provider.db.create([provider.path, "id"], key => {
            callbackKey = key;
            expect(key).toEqual(provider.local ? expect.stringMatching(/^\d+$/) : expect.stringMatching(/^[-0-9A-Z_a-z]{20}$/));
            return value;
        });
        expect(firstKey).toBe(callbackKey);
        expect(await provider.db.read((provider.createdRecord ?? provider.record)(firstKey))).toEqual(value);

        const secondKey = await provider.db.create([provider.path, "id"], {label: "second", timestamp: 123});
        if (provider.local) expect(Number(secondKey)).toBeGreaterThan(Number(firstKey));
        else expect(milliseconds(secondKey)).toBeGreaterThanOrEqual(milliseconds(firstKey));
        expect(await provider.db.read((provider.createdRecord ?? provider.record)(secondKey)))
            .toEqual({label: "second", timestamp: 123});
        await provider.db.update((provider.createdRecord ?? provider.record)(secondKey), {label: "updated"});
        expect(await provider.db.read((provider.createdRecord ?? provider.record)(secondKey)))
            .toEqual({label: "updated", timestamp: 123});

        expect(await provider.db.create([provider.path, {id: "manual"}], {label: "manual"})).toBe("manual");
        expect(await provider.db.read((provider.createdRecord ?? provider.record)("manual"))).toEqual({label: "manual"});
        expect(await keys()).toEqual([firstKey, secondKey, "manual"]);
        expect(await keys({orderBy: "timestamp"})).toEqual([secondKey]);
    });

    it("uses firebase-key's supported timestamp bounds without asserting a reversible random key", () => {
        const at = 1_700_000_000_000;
        expect(milliseconds(pushKey(at, "min"))).toBe(at);
        expect(milliseconds(pushKey(new Date(at), "max"))).toBe(at);
        expect(pushKey(at, "min") < pushKey(at, "max")).toBe(true);
    });

    it("orders integer-like child keys and applies inclusive key bounds in either direction", async () => {
        for (const key of ["10", "2", "02", "alpha", "beta"]) await provider.put(key, {score: 1});
        expect(await keys()).toEqual(["2", "02", "10", "alpha", "beta"]);
        expect(await keys({order: "desc"})).toEqual(["beta", "alpha", "10", "02", "2"]);
        expect(await keys({start: "2", end: "10"})).toEqual(["2", "02", "10"]);
        expect(await keys({start: "2", end: "10", order: "desc"})).toEqual(["10", "02", "2"]);
    });

    it("orders present fields by type and child key, with inclusive field bounds", async () => {
        for (const [key, value] of Object.entries({
            missing: {},
            nullish: {score: null},
            no: {score: false},
            yes: {score: true},
            two: {score: 2},
            alsoTwo: {score: 2},
            text: {score: "2"}
        })) await provider.put(key, value);
        expect(await keys({orderBy: "score"})).toEqual(["no", "yes", "alsoTwo", "two", "text"]);
        expect(await keys({orderBy: "score", order: "desc"})).toEqual(["text", "two", "alsoTwo", "yes", "no"]);
        expect(await keys({orderBy: "score", start: 2, end: 2})).toEqual(["alsoTwo", "two"]);
    });

    it("excludes absent and null ordered fields on an indexed Local field", async () => {
        await provider.put("missing", {label: "none"});
        await provider.put("nullish", {created: null});
        await provider.put("zero", {created: 0});
        await provider.put("one", {created: 1});
        expect(await keys({orderBy: "created"}, 1)).toEqual(["zero", "one"]);
    });

    it("continues after a deleted page boundary without duplicating equal values", async () => {
        for (const key of ["a", "b", "c", "d", "e"]) await provider.put(key, {score: 1});
        const cursor = provider.db.cursor(provider.path, {orderBy: "score", equalTo: 1});
        expect((await cursor.next(2)).map(entry => entry.key)).toEqual(["a", "b"]);
        await provider.remove("b");
        expect((await cursor.next(2)).map(entry => entry.key)).toEqual(["c", "d"]);
        expect((await cursor.next(2)).map(entry => entry.key)).toEqual(["e"]);
        expect(cursor.position).toEqual({index: 4, key: "e", finished: true});
        expect(cursor.count).toBe(5);
    });

    it("writes handler replacements and omits deletions from the returned page", async () => {
        await provider.put("a", {score: 1});
        await provider.put("b", {score: 2});
        await provider.put("c", {score: 3});
        const cursor = provider.db.cursor(provider.path, {
            handle: ({key, value}) => {
                if (key === "a") { value.score = 99; return undefined; }
                if (key === "b") return null;
                return {score: 30};
            }
        });
        expect(await cursor.next(2)).toEqual([
            {key: "a", value: expect.objectContaining({score: 1})},
            {key: "c", value: expect.objectContaining({score: 30})}
        ]);
        expect(await provider.db.read(provider.record("a"))).toMatchObject({score: 1});
        expect(await provider.db.read(provider.record("b"))).toBeUndefined();
        expect(await provider.db.read(provider.record("c"))).toMatchObject({score: 30});
        expect(cursor.position).toMatchObject({index: 1, key: "c"});
        expect(await cursor.next()).toEqual([]);
        expect(cursor.position.finished).toBe(true);
    });

    it("resolves a named path segment to its stored record", async () => {
        await provider.put("a", {score: 1});
        expect(await provider.db.read(provider.record("a"))).toMatchObject({score: 1});
    });
}
