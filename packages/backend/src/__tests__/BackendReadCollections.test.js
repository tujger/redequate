import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import FirebaseServerBackend from "../firebase-server/src/FirebaseServerBackend";

vi.mock("../common", async original => ({...await original(), handlers: {}}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const records = {
    first: {type: "tag.create", value: 1, note: {label: "First"}},
    second: {type: "tag.create", value: 2},
    third: {type: "tag.delete", value: 3},
};
const setup = async provider => {
    if (provider === "local") {
        const storageId = `backend-read-${crypto.randomUUID()}`;
        const backend = new LocalBackend({storageId});
        const database = new LocalDatabase({storageId, backend});
        await database.read(["_activity"]);
        for (const [key, value] of Object.entries(records)) {
            await backend.request("database.create", ["_activity", {activity_type_id: key}], value);
        }
        await backend.request("database.update", ["meta"], {settings: {theme: "dark"}});
        return {backend, database};
    }
    const root = {_activity: records, meta: {settings: {theme: "dark"}}};
    const references = [];
    const database = {ref: vi.fn(address => {
        let field, bound, hasBound = false;
        const query = {
            orderByChild: vi.fn(value => {field = value; return query;}),
            equalTo: vi.fn(value => {bound = value; hasBound = true; return query;}),
            get: vi.fn(async () => {
                let value = address.split("/").reduce((node, part) => node?.[part], root);
                if (hasBound) {
                    value = Object.fromEntries(Object.entries(value ?? {}).filter(([, child]) =>
                        field.split("/").reduce((node, part) => node?.[part], child) === bound));
                    if (!Object.keys(value).length) value = null;
                }
                return {val: () => value ?? null};
            }),
        };
        references.push(query);
        return query;
    })};
    return {backend: new FirebaseServerBackend(() => database), database, references};
};

for (const provider of ["local", "admin"]) describe(provider, () => {
    it.each([
        ["tag.create", {first: records.first, second: records.second}],
        ["tag.delete", {third: records.third}],
        ["absent", null],
    ])("reads only collection records whose type equals %s", async (type, expected) => {
        const {backend, database, references} = await setup(provider);
        expect(await backend.request("database.read", ["_activity", "activity_type_id"],
            {orderBy: ["type"], equalTo: type})).toEqual(expected);
        if (provider === "admin") {
            expect(database.ref).toHaveBeenCalledExactlyOnceWith("_activity");
            expect(references[0].orderByChild).toHaveBeenCalledExactlyOnceWith("type");
            expect(references[0].equalTo).toHaveBeenCalledExactlyOnceWith(type);
        }
    });
    it("keeps unfiltered collections, named records and literal string addresses working", async () => {
        const {backend} = await setup(provider);
        expect(await backend.request("database.read", ["_activity", "activity_type_id"])).toEqual(records);
        expect(await backend.request("database.read", ["_activity", {activity_type_id: "first"}])).toEqual(records.first);
        expect(await backend.request("database.read", "_activity/first")).toEqual(records.first);
        expect(await backend.request("database.read", ["_activity", {activity_type_id: "first"}, {value: "value"}])).toBe(1);
        expect(await backend.request("database.read", "_activity", {orderBy: ["type"], equalTo: "tag.delete"}))
            .toEqual({third: records.third});
        expect(await backend.request("database.read", ["meta", {settings: "settings"}])).toEqual({theme: "dark"});
        expect(await backend.request("database.read", "meta/settings")).toEqual({theme: "dark"});
    });
});

it("matches LocalDatabase collection reads without changing unindexed singleton paths", async () => {
    const {backend, database} = await setup("local");
    const path = ["_activity", "activity_type_id"], options = {orderBy: ["type"], equalTo: "tag.create"};
    expect(await backend.request("database.read", path, options)).toEqual(await database.read(path, options));
    expect(await backend.request("database.read", ["meta", "settings"])).toEqual(await database.read(["meta", "settings"]));
});

it("supports scoped compound-key collections in Local backend reads", async () => {
    const {backend} = await setup("local");
    for (const [chat_id, message_id, created] of [["one", "a", 1], ["one", "b", 2], ["two", "a", 1]]) {
        await backend.request("database.create", ["chats", {chat_id}, {message_id}], {created});
    }
    expect(await backend.request("database.read", ["chats", {chat_id: "one"}, "message_id"],
        {orderBy: ["created"], equalTo: 1})).toEqual({a: {created: 1}});
});
