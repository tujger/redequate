import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../../../packages/database/src/local";
import {openDatabase, parseDatabasePath} from "../../../../packages/database/src/local/helpers";
import {LOCAL_COLLECTIONS} from "../../../../packages/database/src/local/constants";
import {PostData} from "../../../components/PostComponent/PostData";

vi.mock("../../../controllers/General", () => ({cacheDatas: {put: (key, value) => value, remove: () => {}}}));
vi.mock("../../../components/MentionedTextComponent", () => ({tokenizeText: text => [{type: "text", value: text}]}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

const storedRows = async (storageKey, name) => {
    const database = await openDatabase(storageKey);
    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(name);
            const request = transaction.objectStore(name).getAll();
            transaction.oncomplete = () => resolve(request.result);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { database.close(); }
};

it.each(["posts", "replies"])("publishes and fetches %s through PostData using the internal identity", async type => {
    const database = new LocalDatabase({storageKey: "post-data"});
    const post = await PostData({database, type}).create({uid: "u1", text: "created"});
    await post.publish()();
    const fetched = await PostData({database, type}).fetch(post.id);
    expect(fetched.text).toBe("created");
    expect(fetched.created).toEqual(expect.any(Number));
    const rows = await storedRows("post-data", LOCAL_COLLECTIONS[type].store);
    expect(rows).toHaveLength(1);
    expect(rows[0]._key).toBe(parseDatabasePath([{type}, {post_id: post.id}]).key);
});
