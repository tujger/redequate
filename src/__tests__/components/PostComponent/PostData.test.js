import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../../../packages/database/src/local";
import {openDatabase, parseDatabasePath} from "../../../../packages/backend/src/local/database/helpers";
import {LOCAL_COLLECTIONS} from "../../../../packages/backend/src/local/database/constants";
import {PostData} from "../../../components/PostComponent/PostData";

vi.mock("../../../controllers/General", () => ({cacheDatas: {put: (key, value) => value, remove: () => {}}}));
vi.mock("../../../components/MentionedTextComponent", () => ({tokenizeText: text => [{type: "text", value: text}]}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const storedRows = async (storageId, name) => {
    const database = await openDatabase(storageId);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(name);
            const request = transaction.objectStore(name).getAll();
            transaction.oncomplete = () => resolve(request.result);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { database.close(); }
};

it.each(["posts", "replies"])("publishes and fetches %s through PostData in posts", async type => {
    const database = new LocalDatabase({storageId: "post-data"});
    const post = await PostData({database, type}).create({uid: "u1", text: "created"});
    await post.publish()();
    const fetched = await PostData({database, type}).fetch(post.id);
    expect(fetched.text).toBe("created");
    expect(fetched.created).toEqual(expect.any(Number));
    const rows = await storedRows("post-data", LOCAL_COLLECTIONS.posts.store);
    expect(rows).toHaveLength(1);
    expect(rows[0]._local.path).toBe(parseDatabasePath([{type}, {post_id: post.id}]).key);
});

it.each(["fetchCounters", "fetchExtras"])("rejects %s when the database read fails", async method => {
    const error = new Error("PERMISSION_DENIED");
    const database = {read: vi.fn().mockRejectedValue(error)};
    const post = PostData({database});
    post.id = "p1";
    await expect(post[method]("u1")).rejects.toBe(error);
    expect(database.read).toHaveBeenCalledTimes(1);
});

it.each(["fetchCounters", "fetchExtras"])("does not read without an id in %s", async method => {
    const database = {read: vi.fn()};
    await expect(PostData({database})[method]("u1")).rejects.toThrow("Post not submitted yet.");
    expect(database.read).not.toHaveBeenCalled();
});

it("loads counters and extras through their exact selected/query paths", async () => {
    const database = {read: vi.fn().mockResolvedValueOnce({like: 4}).mockResolvedValueOnce({e1: {type: "like"}, e2: {type: "unknown"}})};
    const post = PostData({database});
    post.id = "p1";
    await expect(post.fetchCounters()).resolves.toBe(post);
    await expect(post.fetchExtras("u1")).resolves.toBe(post);
    expect(database.read.mock.calls).toEqual([
        [["_counters", {id: "p1"}]],
        [["extra", "extra_id"], {equalTo: "p1_u1", orderBy: "id_uid"}],
    ]);
    expect(post.extras).toEqual({like: {key: "e1", value: {type: "like"}}});
});
