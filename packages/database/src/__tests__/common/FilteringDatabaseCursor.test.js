import {vi} from "vitest";
import DatabaseCursor from "../../common/DatabaseCursor";
import FilteringDatabaseCursor from "../../common/FilteringDatabaseCursor";

class Source extends DatabaseCursor {
    constructor(entries, options = {}) {
        super(options, "requests");
        this.entries = entries;
        this.offset = 0;
        this.sizes = [];
    }

    async next(n = 1) {
        const heading = await super.next(n);
        this.sizes.push(n);
        const page = this.entries.slice(this.offset, this.offset + n);
        this.offset += page.length;
        this._position = Object.freeze({
            index: this.offset - 1,
            key: page.at(-1)?.key,
            finished: this.offset === this.entries.length
        });
        this._count += heading.length + page.length;
        return [...heading, ...page];
    }
}

const rows = ids => ids.map((id, index) => ({key: `r${index}`, value: {id}}));

it("fills each requested page with matches across source pages in source order", async () => {
    const source = new Source(rows(["other", "other", "target", "other", "target", "target"]));
    const cursor = new FilteringDatabaseCursor(source, ({value}) => value.id === "target");
    expect((await cursor.next(2)).map(({key}) => key)).toEqual(["r2", "r4"]);
    expect(cursor.position).toEqual({index: 1, key: "r4", finished: false});
    expect((await cursor.next(2)).map(({key}) => key)).toEqual(["r5"]);
    expect(cursor.position).toEqual({index: 2, key: "r5", finished: true});
    expect(cursor.position.finished).toBe(true);
    expect(await cursor.next()).toEqual([]);
    expect(cursor.count).toBe(3);
    expect(source.sizes).toEqual([2, 2, 1, 2]);
});

it("does not return an empty first page when later records match", async () => {
    const cursor = new FilteringDatabaseCursor(new Source(rows(["other", "target"])),
        ({value}) => value.id === "target");
    expect(await cursor.next()).toEqual([{key: "r1", value: {id: "target"}}]);
    expect(cursor.position.finished).toBe(true);
});

it.each([
    {equalTo: "target"},
    {start: "a", end: "z"}
])("preserves source query metadata with %j and owns its identity and progress", bounds => {
    const options = {
        group: "requests",
        order: "desc",
        orderBy: ["id"],
        startDate: new Date(100),
        endDate: new Date(200),
        onError: vi.fn(),
        ...bounds
    };
    const source = new Source(rows(["target"]), options);
    const cursor = new FilteringDatabaseCursor(source, () => true);
    expect(cursor.id).not.toBe(source.id);
    expect(cursor.path).toBe(source.path);
    for (const name of Object.keys(options)) expect(cursor[name]).toBe(source[name]);
    expect(cursor.position).not.toBe(source.position);
    expect(cursor.count).toBe(0);
    for (const name of ["source", "hasMore", "update", "remove"]) {
        expect(name in cursor).toBe(false);
    }
});

it("accepts a source handle without reading or invoking it", async () => {
    const handle = vi.fn();
    const source = new Source(rows(["target"]), {handle});
    const getHandle = vi.spyOn(source, "handle", "get");
    const cursor = new FilteringDatabaseCursor(source, () => true);
    expect(await cursor.next()).toEqual(rows(["target"]));
    expect(getHandle).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
});

it("filters entries after the source runs its own handle without running it twice", async () => {
    const handle = vi.fn(entry => ({...entry, value: {id: "target"}}));
    const source = new Source(rows(["other"]), {handle});
    const read = source.next.bind(source);
    source.next = async n => (await read(n)).map(entry => source.handle(entry));
    const cursor = new FilteringDatabaseCursor(source, ({value}) => value.id === "target");
    expect(await cursor.next()).toEqual(rows(["target"]));
    expect(handle).toHaveBeenCalledExactlyOnceWith(rows(["other"])[0]);
});

it("rejects access to the filtering cursor's own handle", () => {
    const cursor = new FilteringDatabaseCursor(new Source([]), () => true);
    expect(() => cursor.handle).toThrow("FilteringDatabaseCursor does not support handle.");
});

it("returns the source group heading once while filtering records", async () => {
    const source = new Source(rows(["other", "target", "target"]), {group: "requests"});
    const cursor = new FilteringDatabaseCursor(source, ({value}) => value.id === "target");
    expect(await cursor.next()).toEqual([{key: "requests"}]);
    expect(await cursor.next(2)).toEqual(rows(["other", "target", "target"]).slice(1));
    expect(await cursor.next()).toEqual([]);
    expect(cursor.count).toBe(3);
    expect(cursor.position).toEqual({index: 2, key: "r2", finished: true});
});

it("supports nested filtering without accessing the forbidden handle", async () => {
    const source = new Source(rows(["other", "target", "other", "target"]));
    const first = new FilteringDatabaseCursor(source, ({value}) => value.id === "target");
    const cursor = new FilteringDatabaseCursor(first, ({key}) => key === "r3");
    expect(await cursor.next()).toEqual([{key: "r3", value: {id: "target"}}]);
    expect(cursor.count).toBe(1);
    expect(first.count).toBe(2);
});

it("keeps already matched entries when a source suppresses a later read", async () => {
    const source = new Source(rows(["target", "target"]));
    const read = source.next.bind(source);
    let calls = 0;
    source.next = n => ++calls === 2 ? undefined : read(calls === 1 ? 1 : n);
    const cursor = new FilteringDatabaseCursor(source, () => true);
    expect(await cursor.next(2)).toBeUndefined();
    expect(await cursor.next(2)).toEqual(rows(["target", "target"]));
    expect(cursor.position.finished).toBe(true);
});

it("rejects invalid page sizes with the base cursor contract", async () => {
    const cursor = new FilteringDatabaseCursor(new Source([]), () => true);
    await expect(cursor.next(0)).rejects.toMatchObject({code: "database/invalid-argument"});
});
