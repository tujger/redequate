import FirebaseDatabase from "../../firebase";
import FirebaseBackendServer from "../../../../backend/src/firebase-server/src/FirebaseBackendServer";
import {getAuth} from "firebase/auth";
import {createFirebase} from "../fixtures/firebase";
vi.mock("firebase/database", () => import("../fixtures/firebase").then(module => module.firebaseDatabaseMock()));
vi.mock("firebase/auth", () => ({getAuth: vi.fn()}));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const response = value => ({ok: true, status: 200, json: async () => value});
it("client uses REST shallow with its own auth token, emulator host and namespace", async () => {
    const fixture = createFirebase();
    fixture.firebase.app.options = {databaseURL: "https://demo-shallow-default-rtdb.firebaseio.com", projectId: "demo-shallow"};
    const original = fixture.firebase.app.database.reference;
    fixture.firebase.app.database.reference = (path, query) => ({...original(path, query), toString: () => `http://127.0.0.1:19000/${path}`});
    const getIdToken = vi.fn(async () => "user-token");
    getAuth.mockReturnValue({currentUser: {getIdToken}, authStateReady: async () => {}});
    const fetch = vi.fn(async () => response({friend: true, following: true}));
    vi.stubGlobal("fetch", fetch);
    const database = new FirebaseDatabase({firebase: fixture.firebase});
    expect(await database.read(["mutual", "mutual_type"], {shallow: true})).toEqual(["friend", "following"]);
    const url = fetch.mock.calls[0][0];
    expect(url.origin).toBe("http://127.0.0.1:19000");
    expect(url.pathname).toBe("/mutual.json");
    expect(url.searchParams.get("ns")).toBe("demo-shallow-default-rtdb");
    expect(url.searchParams.get("auth")).toBe("user-token");
    expect(url.searchParams.get("shallow")).toBe("true");
    expect(fixture.sdk.once).not.toHaveBeenCalled();
});
for (const emulator of [false, true]) it(`admin uses ${emulator ? "emulator owner" : "credential OAuth"} authorization`, async () => {
    if (emulator) vi.stubEnv("FIREBASE_DATABASE_EMULATOR_HOST", "127.0.0.1:19000");
    else vi.stubEnv("FIREBASE_DATABASE_EMULATOR_HOST", "");
    const getAccessToken = vi.fn(async () => ({access_token: "oauth-token"}));
    const get = vi.fn();
    const db = {app: {options: {databaseURL: "https://demo-shallow-default-rtdb.firebaseio.com", credential: {getAccessToken}}},
        ref: path => ({toString: () => `https://demo-shallow-default-rtdb.firebaseio.com/${path}`, get})};
    const fetch = vi.fn(async () => response({friend: true})); vi.stubGlobal("fetch", fetch);
    const backend = new FirebaseBackendServer(() => db);
    expect(await backend.request("database.read", ["mutual", "mutual_type"], {shallow: true})).toEqual(["friend"]);
    const [url, options] = fetch.mock.calls[0];
    expect(url.searchParams.get("shallow")).toBe("true");
    expect(options.headers.Authorization).toBe(`Bearer ${emulator ? "owner" : "oauth-token"}`);
    expect(getAccessToken).toHaveBeenCalledTimes(emulator ? 0 : 1);
    expect(url.origin).toBe(emulator ? "http://127.0.0.1:19000" : "https://demo-shallow-default-rtdb.firebaseio.com");
    expect(get).not.toHaveBeenCalled();
});
it.each([null, false, 5, "text"])("returns [] for REST scalar or missing data %j", async value => {
    const {fetchShallowKeys} = await import("../../common/shallowRead");
    vi.stubGlobal("fetch", vi.fn(async () => response(value)));
    expect(await fetchShallowKeys(new URL("https://example.test/mutual.json?shallow=true"))).toEqual([]);
});
it("propagates denied reads without a full-data fallback", async () => {
    const {fetchShallowKeys} = await import("../../common/shallowRead");
    const fetch = vi.fn(async () => ({ok: false, status: 401, json: async () => ({error: "Permission denied"})}));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchShallowKeys(new URL("https://example.test/mutual.json?shallow=true"))).rejects.toMatchObject({code: "database/permission-denied"});
    expect(fetch).toHaveBeenCalledOnce();
});
