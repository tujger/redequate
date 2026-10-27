import createLocalDatabase from "../../../packages/database/src/__tests__/createLocalDatabase";
import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";

import CounterComponent from "../../components/CounterComponent";
import {counterUiScenarios} from "./counterUiScenarios";

const context = vi.hoisted(() => ({database: null}));
vi.mock("../../controllers", () => ({useDatabase: () => context.database}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
describe("Local real counter UI", () => counterUiScenarios(CounterComponent, context, async (key = "default") => {
    const database = createLocalDatabase({storageId: `counter-ui-${key}`});
    await database.read(["_counters"]);
    return [database, createLocalDatabase({storageId: `counter-ui-${key}`})];
}));
