import {vi} from "vitest";
import PostListener from "../common/handlers/post";
import {parseTokens} from "../common/handlers/tag";

vi.mock("../common/handlers/tag", () => ({parseTokens: vi.fn(), filterTagTokens: async props => props}));
const params = {post_id: "post"};
let listener, debug, log;
beforeEach(() => {
    vi.mocked(parseTokens).mockReset().mockResolvedValue({tokens: []});
    listener = new PostListener({});
    debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    log = vi.spyOn(console, "log").mockImplementation(() => {});
});
it.each([
    [{text: "same"}, {text: "same", edit: {e1: {uid: "user"}}}],
    [{text: "same"}, {text: "same", root: "root"}],
    [{text: "same", images: ["one"]}, {text: "same", images: ["one"]}],
    [{text: null, images: null}, {text: "", images: []}],
    [{}, {text: null, images: []}],
])("skips unchanged content while preserving the existing debug output", async (previous, value) => {
    await listener.onUpdate({previous, value, params});
    expect(parseTokens).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledExactlyOnceWith("[Backend:Post]", "updated [post]", {params, previous, value});
    expect(log).not.toHaveBeenCalled();
});
it.each([
    [{text: "before"}, {text: "after"}],
    [{text: "same"}, {text: "same", images: ["one"]}],
    [{text: "same", images: ["one"]}, {text: "same", images: []}],
    [{text: "same", images: ["one"]}, {text: "same", images: ["two"]}],
    [{text: "same", images: ["one", "two"]}, {text: "same", images: ["two", "one"]}],
    [{text: null}, {text: null, images: ["one"]}],
])("processes changed text or images and keeps the result log", async (previous, value) => {
    const result = {text: value.text ?? "", tokens: []};
    vi.mocked(parseTokens).mockResolvedValue(result);
    await listener.onUpdate({previous, value, params});
    expect(parseTokens).toHaveBeenCalledExactlyOnceWith({text: value.text ?? ""});
    expect(log).toHaveBeenCalledExactlyOnceWith(">>>>>>>>>", result);
});
it("waits for token parsing and propagates its errors", async () => {
    let reject;
    vi.mocked(parseTokens).mockImplementation(() => new Promise((resolve, rejectPromise) => { reject = rejectPromise; }));
    let settled = false;
    const operation = listener.onUpdate({params, previous: {text: "before"}, value: {text: "after"}});
    operation.then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    const error = new Error("parsing failed"); reject(error);
    await expect(operation).rejects.toBe(error);
    expect(log).not.toHaveBeenCalled();
});
