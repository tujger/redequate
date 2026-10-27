import createLocalDatabase from "../../../packages/database/src/__tests__/createLocalDatabase";
import {IDBFactory} from "fake-indexeddb";
import {vi} from "vitest";

import {counterScenarios} from "./counterScenarios";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
describe("Local counter audit", () => counterScenarios(() => [
    createLocalDatabase({storageId: "counter-audit"}),
    createLocalDatabase({storageId: "counter-audit"}),
], {local: true}));
