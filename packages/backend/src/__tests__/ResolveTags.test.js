import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import PostListener from "../common/handlers/post";
import resolveTags from "../common/helpers/resolveTags";

let backend, database;
beforeEach(async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    backend = new LocalBackend({storageId: "resolve-tags"});
    database = new LocalDatabase({storageId: "resolve-tags", backend});
    await database.read(["tag"]);
});
afterEach(() => vi.unstubAllGlobals());
const tagPath = key => ["tag", {tag_id: key}];
const linkPath = (tag, post = "post") => ["_tag", {tag_id: tag}, {post_id: post}];
const resolve = (text, createIfAbsent = false) => resolveTags({backend, text, createIfAbsent});
it.each([undefined, "", "ordinary text", "$[user:reader:Reader]", "$[tag:unfinished]"])("returns no tags for %j without querying or creating records", async text => {
    const request = vi.spyOn(backend, "request");
    expect(await resolve(text, true)).toEqual([]);
    expect(request).not.toHaveBeenCalled();
});
it("normalizes mentions, deduplicates existing records and preserves their author", async () => {
    await backend.request("database.create", tagPath("known"), {id: "whiskytalk", label: "Whisky", uid: "owner"});
    const tags = await resolve("Before $[tag:Whisky-Talk:Label: detail] $[tag:WHISKYTALK:Again]", true);
    expect(tags).toEqual([{key: "known", value: {id: "whiskytalk", label: "Whisky", uid: "owner"}}]);
    expect(Object.keys(await database.read(["tag", "tag_id"]))).toEqual(["known"]);
});
it("creates each absent normalized tag once and rereads its resolved timestamp", async () => {
    const tags = await resolve("$[tag:Whisky-Talk:First] $[tag:WHISKYTALK:Again] $[tag:other:Other]", true);
    expect(tags).toHaveLength(2);
    expect(tags.map(({value}) => value)).toEqual([
        {id: "whiskytalk", label: "First", _sort_name: "whiskytalk", timestamp: expect.any(Number), uid: "0"},
        {id: "other", label: "Other", _sort_name: "other", timestamp: expect.any(Number), uid: "0"},
    ]);
    expect(await resolve("$[tag:whiskytalk:Again] $[tag:other:Other]", true)).toEqual(tags);
});
it("does not create missing tags during read-only resolution", async () => {
    expect(await resolve("$[tag:unknown:Unknown]")).toEqual([]);
    expect(await database.read(["tag", "tag_id"])).toBeUndefined();
});
it("resolves all grouped sources rather than only the first mention", async () => {
    for (const id of ["one", "two", "three"]) await backend.request("database.create", tagPath(id), {id});
    expect((await resolve("$[tag:one:One] $[tag:two:Two] $[tag:three:Three]")).map(tag => tag.key))
        .toEqual(["one", "two", "three"]);
});
it("propagates cursor, creation and reread errors", async () => {
    const text = "$[tag:new:New]", error = new Error("backend failed");
    for (const command of ["database.cursor", "database.create", "database.read"]) {
        const original = backend.request.bind(backend);
        const request = vi.spyOn(backend, "request");
        request.mockImplementation((name, ...args) => name === command ? Promise.reject(error) : original(name, ...args));
        await expect(resolve(text, true)).rejects.toBe(error);
        request.mockRestore();
    }
});
it("creates and updates post tag links while preserving unrelated links", async () => {
    const listener = new PostListener(backend), params = {post_id: "post"};
    const before = {uid: "writer", text: "$[tag:old:Old] $[tag:keep:Keep]"};
    await listener.onCreate({params, value: before});
    const oldTags = await resolve(before.text), byId = Object.fromEntries(oldTags.map(tag => [tag.value.id, tag.key]));
    for (const key of Object.values(byId)) expect(await database.read(linkPath(key))).toBe("writer");
    await backend.request("database.update", ["_tag", {tag_id: byId.old}], {other: "someone"});
    await listener.onUpdate({params, previous: before, value: {uid: "writer", text: "$[tag:new:New] $[tag:keep:Keep]"}});
    expect(await database.read(linkPath(byId.old))).toBeUndefined();
    expect(await database.read(linkPath(byId.old, "other"))).toBe("someone");
    expect(await database.read(linkPath(byId.keep))).toBe("writer");
    const [added] = await resolve("$[tag:new:New]");
    expect(await database.read(linkPath(added.key))).toBe("writer");
});

it("unlinks deleted post tags without creating absent tags or deleting tag records", async () => {
    await backend.request("database.create", tagPath("known"), {id: "known"});
    await backend.request("database.update", ["_tag", {tag_id: "known"}], {post: "writer", other: "someone"});
    await new PostListener(backend).onDelete({params: {post_id: "post"},
        value: {uid: "writer", text: "$[tag:known:Known] $[tag:absent:Absent]"}});
    expect(await database.read(linkPath("known"))).toBeUndefined();
    expect(await database.read(linkPath("known", "other"))).toBe("someone");
    expect(await database.read(["tag", "tag_id"])).toEqual({known: {id: "known"}});
});
