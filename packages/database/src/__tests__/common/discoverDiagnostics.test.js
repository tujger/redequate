import {IDBFactory} from "fake-indexeddb";
import {vi} from "vitest";
import FirebaseDatabase from "../../firebase";
import LocalDatabase from "../../local";
import {createFirebase} from "../fixtures/firebase";
import {diagnosticKey, discoverRoute, traceDiscover} from "../../common/discoverDiagnostics";

beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    localStorage.clear();
});
afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
});

it("remains silent until the shared flag is enabled and never emits raw identifiers", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const local = new LocalDatabase({storageKey: "discover-diagnostic-test"});
    const {firebase} = createFirebase();
    const remote = new FirebaseDatabase({firebase});
    await local.create(["posts", "post_id"], {to: 0, text: "private text"});
    await remote.create(["posts", "post_id"], {to: 0, text: "private text"});
    expect(info).not.toHaveBeenCalled();

    localStorage.setItem("debug.discover", "1");
    const localKey = await local.create(["posts", "post_id"], {to: 0, text: "private text"});
    const firebaseKey = await remote.create(["posts", "post_id"], {to: 0, text: "private text"});
    expect(info.mock.calls.map(([, data]) => JSON.parse(data).provider)).toEqual(["local", "firebase"]);
    expect(info.mock.calls.map(([, data]) => JSON.parse(data).key)).toEqual([
        diagnosticKey(localKey), diagnosticKey(firebaseKey)
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain("private text");
    expect(JSON.stringify(info.mock.calls)).not.toContain(firebaseKey);
    expect(JSON.parse(info.mock.calls[0][1])).toHaveProperty("timestamp");
});

it("sanitizes routes and ignores inaccessible storage and console failures", () => {
    expect(discoverRoute("/post/sensitive-id")).toBe("/post/:key");
    expect(discoverRoute("/discover")).toBe("/discover");
    expect(discoverRoute("/profile/private-id")).toBe("/other");
    const info = vi.spyOn(console, "info").mockImplementation(() => { throw new Error("console blocked"); });
    localStorage.setItem("debug.discover", "1");
    expect(() => traceDiscover("test")).not.toThrow();
    expect(info).toHaveBeenCalledTimes(1);
});

it("correlates Discover cursor creation and reads without exposing cursor IDs", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const database = new LocalDatabase({storageKey: "discover-cursor-diagnostic"});
    const options = {orderBy: ["to"], equalTo: 0, order: "desc"};
    await database.cursor(["posts", "post_id"], options).next(10);
    expect(info).not.toHaveBeenCalled();
    localStorage.setItem("debug.discover", "1");
    const cursor = database.cursor(["posts", "post_id"], options);
    await cursor.next(10);
    const records = info.mock.calls.map(([, data]) => JSON.parse(data));
    expect(records).toContainEqual(expect.objectContaining({
        event: "discover.cursor.created", cursor: diagnosticKey(cursor.id), order: "desc"
    }));
    expect(records).toContainEqual(expect.objectContaining({
        event: "discover.cursor.next", cursor: diagnosticKey(cursor.id), n: 10, index: -1
    }));
    expect(JSON.stringify(records)).not.toContain(cursor.id);
});
