import {vi} from "vitest";
import postItemTransform from "../../../components/PostComponent/postItemTransform";

const context = vi.hoisted(() => ({post: null, fetchAuthor: vi.fn(), user: {id: "viewer"}}));
vi.mock("../../../controllers/General", () => ({cacheDatas: {fetch: (id, fetch) => fetch(id)}}));
vi.mock("../../../controllers/useCurrentUserData", () => ({getCurrentUserData: () => context.user}));
vi.mock("../../../controllers/UserData", () => ({
    default: class {
        static PUBLIC = "public";
        static NAME = "name";
        static IMAGE = "image";
        fetch(id, fields) { return context.fetchAuthor(id, fields); }
    }
}));
vi.mock("../../../components/MutualComponent", () => ({MutualError: {NOT_FOUND: "not-found"}}));
vi.mock("../../../components/PostComponent/PostData", () => ({PostData: () => ({fetch: async () => context.post})}));

it("starts counters, extras and author reads together after fetching the post", async () => {
    let resolveCounters;
    const counters = new Promise(resolve => { resolveCounters = resolve; });
    context.post = {uid: "author", fetchCounters: vi.fn(() => counters), fetchExtras: vi.fn().mockResolvedValue({})};
    const author = {name: "Author"};
    context.fetchAuthor.mockResolvedValue(author);
    const pending = postItemTransform({database: {}})({key: "post"});
    // Flush the asynchronous post/cache lookup while the counters remain blocked.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.post.fetchCounters).toHaveBeenCalledTimes(1);
    expect(context.post.fetchExtras).toHaveBeenCalledExactlyOnceWith("viewer");
    expect(context.fetchAuthor).toHaveBeenCalledExactlyOnceWith("author", ["public"]);
    resolveCounters({});
    await expect(pending).resolves.toBe(context.post);
    expect(context.post._userData).toBe(author);
});

it("rejects a failed enrichment instead of leaving the transformation pending", async () => {
    const error = new Error("denied");
    context.post = {uid: "author", fetchCounters: vi.fn().mockRejectedValue(error), fetchExtras: vi.fn().mockResolvedValue({})};
    context.fetchAuthor.mockResolvedValue({name: "Author"});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(postItemTransform({database: {}})({key: "post"})).rejects.toBe(error);
});
