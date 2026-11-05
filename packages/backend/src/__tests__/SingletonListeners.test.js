import {IDBFactory} from "fake-indexeddb";
import LocalBackend from "../local/LocalBackend";
import LocalDatabase from "../../../database/src/local";
import onEvents from "../local/database/onEvents";
import MetaListener from "../common/handlers/meta";

let sequence = 0;
const stops = [];
beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { for (const stop of stops.splice(0)) stop(); vi.unstubAllGlobals(); });
async function setup() {
    const storageId = `singleton-listeners-${++sequence}`;
    const backend = new LocalBackend({storageId});
    const database = new LocalDatabase({storageId});
    database.setBackend(backend);
    backend.setDatabase(database);
    await database.read(["meta"]);
    return {backend, database};
}
function observe(backend, path) {
    const listener = {path, onCreate: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn()};
    stops.push(onEvents(listener)(backend));
    return listener;
}
const patch = (backend, entries) => backend.request("database.update", "", new Map(entries));
const field = key => ["meta", {[key]: key}];

it("delivers maintenance events and activity through the real MetaListener", async () => {
    const create = vi.spyOn(MetaListener.prototype, "onCreate");
    const update = vi.spyOn(MetaListener.prototype, "onUpdate");
    const remove = vi.spyOn(MetaListener.prototype, "onDelete");
    const {backend, database} = await setup();
    await patch(backend, [[field("maintenance"), {message: "Before"}]]);
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith({params: {setting: "maintenance"}, value: {message: "Before"}}));
    const activities = () => database.read(["activity", "activity_id"]);
    await vi.waitFor(async () => expect(Object.values(await activities() ?? {})).toContainEqual(expect.objectContaining({
        type: "settings.maintenance", details: {message: "Before", state: "on"},
    })));
    await patch(backend, [[field("maintenance"), {message: "After"}]]);
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith({params: {setting: "maintenance"}, previous: {message: "Before"}, value: {message: "After"}}));
    await vi.waitFor(async () => expect(Object.values(await activities() ?? {})).toContainEqual(expect.objectContaining({
        type: "settings.update", details: {message: ["Before", "=>", "After"]},
    })));
    await patch(backend, [[field("maintenance"), null]]);
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith({params: {setting: "maintenance"}, value: {message: "After"}}));
    await vi.waitFor(async () => expect(Object.values(await activities() ?? {})).toContainEqual(expect.objectContaining({
        type: "settings.maintenance", details: {message: "After", state: "off"},
    })));
});

it("matches separate batch fields including falsy values without exposing _id", async () => {
    const {backend} = await setup();
    const listener = observe(backend, ["meta", "setting"]);
    await patch(backend, [[field("zero"), 0], [field("flag"), false], [field("empty"), ""], [field("missing"), null]]);
    await vi.waitFor(() => expect(listener.onCreate).toHaveBeenCalledTimes(3));
    expect(listener.onCreate.mock.calls.map(([event]) => event)).toEqual([
        {params: {setting: "zero"}, value: 0},
        {params: {setting: "flag"}, value: false},
        {params: {setting: "empty"}, value: ""},
    ]);
    await patch(backend, [[field("zero"), 1], [field("flag"), null]]);
    await vi.waitFor(() => expect(listener.onDelete).toHaveBeenCalledExactlyOnceWith({params: {setting: "flag"}, value: false}));
    expect(listener.onUpdate).toHaveBeenCalledExactlyOnceWith({params: {setting: "zero"}, previous: 0, value: 1});
});

it("matches nested variables and fixed segments, skipping missing and scalar branches", async () => {
    const {backend} = await setup();
    const listener = observe(backend, ["meta", {settings: "settings"}, "group", "entry", {enabled: "enabled"}]);
    await patch(backend, [[field("settings"), {
        first: {one: {enabled: false}, two: {enabled: 0}, missing: {}, scalar: 1},
        second: {three: {enabled: ""}}, scalar: true,
    }]]);
    await vi.waitFor(() => expect(listener.onCreate).toHaveBeenCalledTimes(3));
    expect(listener.onCreate.mock.calls.map(([event]) => event)).toEqual([
        {params: {settings: "settings", group: "first", entry: "one", enabled: "enabled"}, value: false},
        {params: {settings: "settings", group: "first", entry: "two", enabled: "enabled"}, value: 0},
        {params: {settings: "settings", group: "second", entry: "three", enabled: "enabled"}, value: ""},
    ]);
    const absent = observe(backend, ["meta", {absent: "absent"}, "key"]);
    await patch(backend, [[field("unrelated"), true]]);
    expect(absent.onCreate).not.toHaveBeenCalled();
});

it("continues to reject undeclared listener fields on indexed stores", async () => {
    const {backend} = await setup();
    observe(backend, ["extra", "setting"]);
    await expect(patch(backend, [[["extra", {extra_id: "test"}], {type: "like"}]]))
        .rejects.toThrow("No declared index for listener field setting.");
});
