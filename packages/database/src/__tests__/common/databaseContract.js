import {vi} from "vitest";
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
    it.each(["asc", "desc"])("orders nested mixed values and object/array ties in %s order", async order => {
        for (const [key, sort] of [["missing", undefined], ["null", null], ["false", false],
            ["true", true], ["number", 2], ["string", "2"], ["obj", {z: 1}],
            ["array", [1]], ["2", {a: 1}], ["02", {b: 1}], ["10", {c: 1}]]) {
            await provider.put(key, {label: key, nested: sort === undefined ? {} : {sort}});
        }
        const expected = ["false", "true", "number", "string", "2", "02", "10", "array", "obj"];
        expect(await keys({orderBy: "nested/sort", order}, 1)).toEqual(order === "asc" ? expected : expected.reverse());
    });

    it.each(["asc", "desc"])("orders child values and scalar equality in %s order", async order => {
        for (const [key, value] of [["false", false], ["true", true], ["number", 2],
            ["string", "2"], ["array", [1]], ["obj", {z: 1}]]) await provider.put(key, value);
        const expected = ["false", "true", "number", "string", "array", "obj"];
        expect(await keys({orderBy: "", order}, 1)).toEqual(order === "asc" ? expected : expected.reverse());
        expect(await keys({equalTo: false, order})).toEqual(["false"]);
    });

    it("applies prefix and null/boolean boundaries without treating null as an absent option", async () => {
        for (const [key, value] of [["a", {created: null}], ["b", {created: false}],
            ["c", {created: true}], ["d", {created: 2}], ["e", {created: "Al"}],
            ["f", {created: "Alice"}], ["g", {created: "Bob"}]]) await provider.put(key, {label: key, ...value});
        expect(await keys({orderBy: "created", start: null, end: false}, 1)).toEqual(["b"]);
        expect(await keys({orderBy: "created", equalTo: null}, 1)).toEqual([]);
        expect(await keys({orderBy: "created", equalTo: false}, 1)).toEqual(["b"]);
        expect(await keys({orderBy: "created", start: "Al"}, 1)).toEqual(["e", "f"]);
        expect(await keys({orderBy: "created", start: "Al", end: "Al"}, 1)).toEqual(["e"]);
        expect(await provider.db.read(provider.path, {orderBy: "created", equalTo: null}))
            .toEqual({a: expect.objectContaining({label: "a"})});
    });

    it.each(["asc", "desc"])("continues across moved sort values in %s order", async order => {
        for (const [key, created] of [["a", 1], ["b", 2], ["c", 3], ["d", 4]]) await provider.put(key, {created});
        const cursor = provider.db.cursor(provider.path, {orderBy: "created", order});
        const first = await cursor.next(1);
        const visited = order === "asc" ? "a" : "d";
        const missed = order === "asc" ? "c" : "b";
        await provider.put(visited, {created: order === "asc" ? 10 : -10});
        await provider.put(missed, {created: order === "asc" ? 0 : 5});
        const rest = [];
        while (!cursor.position.finished) rest.push(...await cursor.next(1));
        expect(first.map(entry => entry.key)).toEqual([visited]);
        expect(rest.map(entry => entry.key)).toEqual(order === "asc" ? ["b", "d"] : ["c", "a"]);
        expect(cursor.count).toBe(3);
    });

    it("validates page size and query bounds and finishes empty cursors", async () => {
        const cursor = provider.db.cursor(provider.path);
        expect(cursor.position).toEqual({index: -1, key: undefined, finished: false});
        for (const size of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) await expect(cursor.next(size)).rejects.toBeDefined();
        expect(await cursor.next(1)).toEqual([]);
        expect(cursor.position).toEqual({index: -1, key: undefined, finished: true});
        for (const options of [{order: "invalid"}, {start: 2}, {start: null}, {start: false}, {orderBy: "created", start: {}},
            {equalTo: false, start: "a"}]) expect(() => provider.db.cursor(provider.path, options)).toThrow();
    });

    it("writes ordered-field removals and reports subscription membership and counters", async () => {
        await provider.put("a", {created: 1, label: "a"});
        const cursor = provider.db.cursor(provider.path, {orderBy: "created", start: 1, end: 2});
        await cursor.next(10);
        const events = [];
        const subscriptions = [cursor.subscribe(event => events.push({...event, count: cursor.count}))];
        try {
            // Synchronize the independent query baseline before making observable writes.
            await provider.db.read(provider.path);
            await new Promise(resolve => setTimeout(resolve, 30));
            expect(events).toEqual([]);
            await provider.put("b", {created: 2, label: "b"});
            await vi.waitFor(() => expect(events).toHaveLength(1));
            await provider.put("b", {created: 2, label: "edited"});
            await vi.waitFor(() => expect(events).toHaveLength(2));
            await provider.put("b", {created: null, label: "removed field"});
            await vi.waitFor(() => expect(events).toHaveLength(3));
            await provider.put("b", {created: 1, label: "back"});
            await vi.waitFor(() => expect(events).toHaveLength(4));
            await provider.remove("a");
            await vi.waitFor(() => expect(events).toHaveLength(5));
            expect(events.map(({type, entry, count}) => [type, entry.key, count]))
                .toEqual([["add", "b", 2], ["change", "b", 2], ["remove", "b", 1], ["add", "b", 2], ["remove", "a", 1]]);
            expect(subscriptions[0]).toMatchObject({active: true, added: 2, changed: 1, removed: 2});
            expect(cursor.position).toEqual({index: 0, key: "a", finished: true});
        } finally {
            subscriptions.forEach(subscription => { subscription.unsubscribe(); subscription.unsubscribe(); });
        }
        expect(subscriptions[0].active).toBe(false);
    });

    it("omits handler replacements that delete the ordered field and awaits handlers sequentially", async () => {
        for (const [key, created] of [["a", 1], ["b", 2], ["c", 3]]) await provider.put(key, {created});
        const handled = [];
        let active = false;
        const cursor = provider.db.cursor(provider.path, {
            orderBy: "created",
            handle: async ({key, value}) => {
                expect(active).toBe(false);
                active = true;
                await Promise.resolve();
                handled.push(key);
                active = false;
                return key === "b" ? {label: "no field"} : {...value, label: "saved"};
            }
        });
        const result = await cursor.next(3);
        expect(result.map(entry => entry.key)).toEqual(["a", "c"]);
        expect(handled).toEqual(["a", "b", "c"]);
        expect(await provider.db.read(provider.record("b"))).toEqual({label: "no field"});
        expect(cursor.count).toBe(2);
        expect(cursor.position.finished).toBe(true);
    });

    it.each(["asc", "desc"])("revisits moved entries in the atomic provider cursor in %s order", async order => {
        for (const [key, created] of [["a", 1], ["b", 2], ["c", 3]]) await provider.put(key, {created});
        const handled = [];
        const cursor = provider.rawCursor({orderBy: "created", order, handle: ({key}) => { handled.push(key); }});
        const moved = order === "asc" ? "a" : "c";
        expect((await cursor.next(1))[0].key).toBe(moved);
        await provider.put(moved, {created: order === "asc" ? 10 : -10});
        const rest = [];
        while (!cursor.position.finished) rest.push(...await cursor.next(1));
        expect(rest.map(entry => entry.key)).toEqual(order === "asc" ? ["b", "c", "a"] : ["b", "a", "c"]);
        expect(handled).toEqual(order === "asc" ? ["a", "b", "c", "a"] : ["c", "b", "a", "c"]);
        expect(cursor.count).toBe(4);
        expect(cursor.position.index).toBe(3);
    });

    it("uses signed int32 key order and lexicographic order beyond int32", async () => {
        const expected = ["-2147483648", "-2", "0", "2", "02", "10", "2147483647", "-2147483649", "2147483648", "alpha"];
        for (const key of [...expected].reverse()) await provider.put(key, {label: key});
        expect(await keys({}, 1)).toEqual(expected);
        expect(await keys({start: "-2", end: "02"}, 1)).toEqual(["-2", "0", "2", "02"]);
    });

    it("handles initial listener values separately from subsequent child events", async () => {
        await provider.put("b", {label: "baseline"});
        const values = [];
        const added = []; const changed = []; const removed = [];
        const listener = provider.db.addEventListener([provider.path], {
            onChange: value => values.push(value),
            onChildAdd: entry => added.push(entry),
            onChildChange: entry => changed.push(entry),
            onChildRemove: entry => removed.push(entry)
        });
        try {
            await vi.waitFor(() => expect(values).toHaveLength(1));
            expect(added).toEqual([]);
            await provider.put("a", {label: "before boundary"});
            await provider.put("c", {label: "after boundary"});
            await vi.waitFor(() => expect(added.map(entry => entry.key)).toEqual(["c"]));
            await provider.put("b", {label: "changed"});
            await vi.waitFor(() => expect(changed.map(entry => entry.key)).toEqual(["b"]));
            await provider.remove("a");
            await vi.waitFor(() => expect(removed.map(entry => entry.key)).toEqual(["a"]));
        } finally { listener.remove(); listener.remove(); }
    });
    it("keeps cursor subscriptions independent and detaches each one idempotently", async () => {
        await provider.put("a", {created: 1});
        const cursor = provider.db.cursor(provider.path, {orderBy: "created"});
        const firstEvents = []; const secondEvents = [];
        const first = cursor.subscribe(event => firstEvents.push(event));
        const second = cursor.subscribe(event => secondEvents.push(event));
        try {
            await provider.db.read([provider.path]);
            await new Promise(resolve => setTimeout(resolve, 30));
            expect(first).not.toBe(second);
            expect(first.id).toBe(cursor.id);
            expect(second.id).toBe(cursor.id);
            await provider.put("b", {created: 2});
            await vi.waitFor(() => expect([firstEvents.length, secondEvents.length]).toEqual([1, 1]));
            expect(cursor.count).toBe(2);
            first.unsubscribe(); first.unsubscribe();
            await provider.put("c", {created: 3});
            await vi.waitFor(() => expect(secondEvents).toHaveLength(2));
            expect(firstEvents).toHaveLength(1);
            expect(first).toMatchObject({active: false, added: 1});
            expect(second).toMatchObject({active: true, added: 2});
            expect(cursor.position).toEqual({index: -1, key: undefined, finished: false});
        } finally { first.unsubscribe(); second.unsubscribe(); }
    });

    it("does not change storage when a cursor handler fails", async () => {
        await provider.put("a", {created: 1});
        const failure = new Error("handler failed");
        const cursor = provider.db.cursor(provider.path, {
            handle: ({value}) => {
                value.created = 10;
                throw failure;
            }
        });
        await expect(cursor.next(1)).rejects.toBe(failure);
        expect(await provider.db.read(provider.record("a"))).toEqual({created: 1});
        expect(cursor.count).toBe(0);
    });
    it("reads a collection using its trailing identity field and applies queries at its parent", async () => {
        const first = await provider.db.create([provider.path, "user_id"], {name: "Alice", visit: 1});
        const second = await provider.db.create([provider.path, "user_id"], {name: "Bob", visit: 2});
        expect(await provider.db.read([provider.path, "user_id"]))
            .toEqual({[first]: {name: "Alice", visit: 1}, [second]: {name: "Bob", visit: 2}});
        expect(await provider.db.read([provider.path, "user_id"], {orderBy: "visit", equalTo: 2}))
            .toEqual({[second]: {name: "Bob", visit: 2}});
        expect(await provider.db.read([provider.path, {user_id: first}])).toEqual({name: "Alice", visit: 1});
        expect(await provider.db.read([provider.path, {user_id: first}, {name: "name"}])).toBe("Alice");
        expect(await provider.db.read([provider.path, {user_id: "absent"}])).toBeUndefined();
    });

    it("reads named concrete branches without returning their parent collection", async () => {
        await provider.db.update([provider.path, "settings"], () => ({theme: "dark"}));
        await provider.db.update([provider.path, {support: "support"}], () => "support-user");
        expect(await provider.db.read([provider.path, {settings: "settings"}])).toEqual({theme: "dark"});
        expect(await provider.db.read([provider.path, {support: "support"}])).toBe("support-user");
        expect(await provider.db.read([provider.path, {settings: "settings"}, {theme: "theme"}])).toBe("dark");
        expect(await provider.db.read([provider.path, {missing: "missing"}])).toBeUndefined();
        expect(await provider.db.read(`${provider.path}/settings/theme`)).toBe("dark");
    });

    it("reads a selected record with its nested collections and explicit scalar fields", async () => {
        const user = [provider.path, {user_id: "u1"}];
        await provider.db.create(user, {name: "User", email: "user@example.test"});
        const child = await provider.db.create([...user, "devices", "device_id"], {locale: "en"});
        expect(await provider.db.read(user)).toEqual({name: "User", email: "user@example.test", devices: {[child]: {locale: "en"}}});
        expect(await provider.db.read([...user, "devices", "device_id"])).toEqual({[child]: {locale: "en"}});
        expect(await provider.db.read([...user, {devices: "devices"}, {device_id: child}, {locale: "locale"}])).toBe("en");
        expect(await provider.db.read(`${provider.path}/u1/email`)).toBe("user@example.test");
    });

    it("filters extras by id_uid at the collection rather than a literal key-field child", async () => {
        const matching = await provider.db.create(["extra", "extra_id"], {id_uid: "post_user", type: "like"});
        await provider.db.create(["extra", "extra_id"], {id_uid: "other_user", type: "like"});
        expect(await provider.db.read(["extra", "extra_id"], {orderBy: "id_uid", equalTo: "post_user"}))
            .toEqual({[matching]: {id_uid: "post_user", type: "like"}});
        expect(await provider.db.read(["extra", {extra_id: "extra_id"}])).toBeUndefined();
    });
}
