import {IDBFactory} from "fake-indexeddb";
import {vi} from "vitest";
import LocalDatabase from "../../../packages/database/src/local";
import {counterScenarios} from "./counterScenarios";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
describe("Local counter audit", () => counterScenarios(() => [
    new LocalDatabase({storageId: "counter-audit"}),
    new LocalDatabase({storageId: "counter-audit"}),
], {local: true}));
