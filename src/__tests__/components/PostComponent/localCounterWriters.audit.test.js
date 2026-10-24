import {knownCounterFailure} from "../../controllers/knownCounterFailure";
import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../../../packages/database/src/local";
import {PostData} from "../../../components/PostComponent/PostData";
import counterControl from "../../../controllers/counterControl";
import {mutualRequest} from "../../../components/MutualComponent/mutualComponentControls";
import {MutualMode} from "../../../components/MutualComponent/MutualConstants";

vi.mock("../../../controllers/General", () => ({cacheDatas: {put: (_, value) => value, remove() {}}}));
vi.mock("../../../components/MentionedTextComponent", () => ({tokenizeText: text => [{type: "text", value: text}]}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

knownCounterFailure.each(["like", "dislike"])("C8: Local %s updates persisted counters, not only PostData memory", async type => {
    const database = new LocalDatabase({storageKey: "local-writers"});
    const post = PostData({database, allowedExtras: ["like", "dislike"]}); post.id = "p1";
    await post.fetchCounters(); await post.fetchExtras("reader");
    await post.putExtra({type, uid: "reader"});
    expect(post.counter(type)).toBe(1);
    expect((await database.cursor(["extra", "extra_id"]).next(10))).toHaveLength(1);
    expect(await counterControl({database, path: [{id: "p1"}, type]})).toBe(1);
});
knownCounterFailure("C8: Local following creates a relation and updates both directional counters", async () => {
    const database = new LocalDatabase({storageKey: "local-follow-writers"});
    const result = await mutualRequest({database, currentUserData: {id: "reader"}, mutualId: "author",
        mutualType: "users_public", mutualMode: MutualMode.SIMPLEX_QUIET, typeId: "following"});
    expect(result.key).toEqual(expect.any(String));
    expect(await database.read(["mutual", {mutual_type: "following"}, {mutual_id: result.key}])).toMatchObject({uid: "reader", id: "author"});
    expect(await counterControl({database, path: [{id: "reader"}, "mutual", {mutual_type: "following"}]})).toBe(1);
    expect(await counterControl({database, path: [{id: "author"}, "mutual", {mutual_type: "following_s"}]})).toBe(1);
});

knownCounterFailure("C8: publishing a Local post updates its author's persisted count", async () => {
    const database = new LocalDatabase({storageKey: "local-post-writers"});
    const post = await PostData({database}).create({uid: "author", text: "Root"});
    await post.publish()();
    expect(await database.read(["posts", {post_id: post.id}])).toMatchObject({uid: "author", to: 0});
    expect(await counterControl({database, path: [{id: "author"}, "posts"]})).toBe(1);
});
knownCounterFailure("C8: creating a Local friend request updates the pending count", async () => {
    const database = new LocalDatabase({storageKey: "local-request-writers"});
    const result = await mutualRequest({database, currentUserData: {id: "reader"}, mutualId: "author",
        mutualType: "users_public", mutualMode: MutualMode.DUPLEX_APPROVE, typeId: "friend"});
    expect(await database.read(["mutualrequests", {mutual_type: "friend"}, {mutual_id: result.key}]))
        .toMatchObject({uid: "reader", id: "author"});
    expect(await counterControl({database, path: [{id: "author"}, "mutualrequests", {mutual_type: "friend"}]})).toBe(1);
});
