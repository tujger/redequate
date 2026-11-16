import {singletonMetaStore} from "../../../../../src/__tests__/createService";
import createService from "../../../../../src/__tests__/createService";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../local";
import LocalBackend from "../../../../backend/src/local/LocalBackend";
vi.mock("../../../../backend/src/common", async original => ({...await original(), handlers: {}}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
async function setup() {
    const storageId = `shallow-${crypto.randomUUID()}`;
    const backend = new LocalBackend({storageId});
    const database = createService(LocalDatabase, {stores: [singletonMetaStore], storageId, backend});
    await database.read(["mutual"]);
    await backend.request("database.update", "", new Map([
        [["mutual", {mutual_type: "friend"}, {mutual_id: "r1"}], {uid: "a", id: "b"}],
        [["mutual", {mutual_type: "friend"}, {mutual_id: "r2"}], {uid: "a", id: "c"}],
        [["mutual", {mutual_type: "following"}, {mutual_id: "r1"}], {uid: "a", id: "b"}],
        [["singleton"], {settings: {theme: "dark"}, scalar: "text"}]
    ]));
    return {database, backend};
}
for (const provider of ["database", "backend"]) describe(provider, () => {
    it("returns distinct branch keys and scoped record keys", async () => {
        const {database, backend} = await setup();
        const read = path => provider === "database" ? database.read(path, {shallow: true}) : backend.request("database.read", path, {shallow: true});
        expect((await read(["mutual", "mutual_type"])).sort()).toEqual(["following", "friend"]);
        expect((await read(["mutual"])).sort()).toEqual(["following", "friend"]);
        expect((await read("mutual")).sort()).toEqual(["following", "friend"]);
        expect((await read(["mutual", {mutual_type: "friend"}, "mutual_id"])).sort()).toEqual(["r1", "r2"]);
        expect(await read(["mutual", {mutual_type: "missing"}, "mutual_id"])).toEqual([]);
        expect(await read(["singleton", {field: "scalar"}])).toEqual([]);
        expect(await read(["singleton", {field: "settings"}])).toEqual(["theme"]);
    });
});
it("validates shallow and query incompatibility before reading", async () => {
    const {database, backend} = await setup();
    for (const options of [{shallow: "yes"}, {shallow: null}, {shallow: true, orderBy: "uid"},
        {shallow: true, equalTo: false}, {shallow: true, start: "a"}, {shallow: true, end: "z"}, {shallow: true, order: "asc"}]) {
        await expect(database.read(["mutual", "mutual_type"], options)).rejects.toMatchObject({code: "database/invalid-argument"});
        await expect(backend.request("database.read", ["mutual", "mutual_type"], options)).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    const onError = vi.fn();
    expect(await database.read(["mutual"], {shallow: "bad", onError})).toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
});
it("leaves ordinary reads and shallow:false unchanged", async () => {
    const {database, backend} = await setup();
    const path = ["mutual", {mutual_type: "friend"}, "mutual_id"];
    expect(await database.read(path, {shallow: false})).toEqual(await database.read(path));
    expect(await backend.request("database.read", path, {shallow: false})).toEqual(await backend.request("database.read", path));
});
