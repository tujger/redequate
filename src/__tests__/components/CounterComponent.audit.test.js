import {vi} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import LocalDatabase from "../../../packages/database/src/local";
import CounterComponent from "../../components/CounterComponent";
import {counterUiScenarios} from "./counterUiScenarios";

const context = vi.hoisted(() => ({database: null}));
vi.mock("../../controllers", () => ({useDatabase: () => context.database}));
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
describe("Local real counter UI", () => counterUiScenarios(CounterComponent, context, (key = "default") => [
    new LocalDatabase({storageKey: `counter-ui-${key}`}),
    new LocalDatabase({storageKey: `counter-ui-${key}`}),
]));
