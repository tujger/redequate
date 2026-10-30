import {vi} from "vitest";
import {firebase, database, backend} from "../common";
import FirebaseDatabase from "../../../packages/database/src/firebase";
import CounterComponent from "../../components/CounterComponent";
import {counterScenarios} from "./counterScenarios";
import {counterUiScenarios} from "../components/counterUiScenarios";

const context = vi.hoisted(() => ({database: null}));
vi.mock("../../controllers", () => ({useDatabase: () => context.database}));
const instances = () => [database, new FirebaseDatabase({firebase, backend})];
describe("Firebase emulator counter audit", () => counterScenarios(instances));
describe("Firebase emulator real counter UI", () => counterUiScenarios(CounterComponent, context, instances));
