import {vi} from "vitest";
import PostListener from "../common/handlers/post";
import resolveTags from "../common/helpers/resolveTags";

vi.mock("../common/helpers/resolveTags", () => ({default: vi.fn()}));
const params = {post_id: "post"};
let backend, listener;
beforeEach(() => {
    vi.mocked(resolveTags).mockReset().mockResolvedValue([]);
    backend = {request: vi.fn(async (name, path, value, options) => options?.mode === "read"
        ? {value: null, etag: "current"} : {committed: true, value})};
    listener = new PostListener(backend);
});
it.each([
    [{text: "same"}, {text: "same", edit: {e1: {uid: "user"}}}],
    [{text: "same"}, {text: "same", root: "root"}],
    [{text: "same", images: ["one"]}, {text: "same", images: ["one"]}],
    [{text: null, images: null}, {text: "", images: []}],
    [{}, {text: null, images: []}],
])("skips unchanged content", async (previous, value) => {
    await listener.onUpdate({previous, value, params});
    expect(resolveTags).not.toHaveBeenCalled();
    expect(backend.request).not.toHaveBeenCalled();
});
it.each([
    [{text: "before"}, {text: "after"}],
    [{text: "same"}, {text: "same", images: ["one"]}],
    [{text: "same", images: ["one"]}, {text: "same", images: []}],
    [{text: "same", images: ["one"]}, {text: "same", images: ["two"]}],
    [{text: "same", images: ["one", "two"]}, {text: "same", images: ["two", "one"]}],
    [{text: null}, {text: null, images: ["one"]}],
])("resolves old tags without creation and new tags with creation", async (previous, value) => {
    await listener.onUpdate({previous, value, params});
    expect(resolveTags.mock.calls).toEqual([
        [{backend, text: previous.text ?? ""}],
        [{backend, text: value.text ?? "", createIfAbsent: true}],
    ]);
});
it("links only added tags and removes only deleted tags", async () => {
    const tag = key => ({key, value: {id: key}});
    vi.mocked(resolveTags).mockResolvedValueOnce([tag("old"), tag("keep")])
        .mockResolvedValueOnce([tag("new"), tag("keep")]);
    await listener.onUpdate({params, previous: {text: "before"}, value: {text: "after", uid: "writer"}});
    expect(backend.request.mock.calls).toEqual([
        ["database.update", ["_tag", {tag_id: "new"}, {post_id: "post"}], null, {mode: "read"}],
        ["database.delete", ["_tag", {tag_id: "old"}, {post_id: "post"}]],
        ["database.update", ["_tag", {tag_id: "new"}, {post_id: "post"}], "writer", {mode: "replace", etag: "current"}],
    ]);
});
it("does not link replies but still unlinks removed tags", async () => {
    vi.mocked(resolveTags).mockResolvedValueOnce([{key: "old"}]).mockResolvedValueOnce([{key: "new"}]);
    await listener.onUpdate({params, previous: {text: "before"}, value: {text: "after", to: "parent"}});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.delete", ["_tag", {tag_id: "old"}, {post_id: "post"}]);
});
it("waits for tag resolution and propagates its error", async () => {
    let reject;
    vi.mocked(resolveTags).mockImplementationOnce(() => new Promise((_, rejectPromise) => { reject = rejectPromise; }));
    const operation = listener.onUpdate({params, previous: {text: "before"}, value: {text: "after"}});
    const assertion = expect(operation).rejects.toThrow("resolving failed");
    reject(new Error("resolving failed"));
    await assertion;
    expect(backend.request).not.toHaveBeenCalled();
});
