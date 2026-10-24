// @vitest-environment node
import {runInNewContext} from "node:vm";
import GlobalStore from "../../../controllers/AppContext/GlobalStore";

it.each([
    "new Date()", "new Map()", "new Set()", "new WeakMap()", "new WeakSet()",
    "new ArrayBuffer(8)", "new SharedArrayBuffer(8)", "new Uint8Array(8)",
    "new DataView(new ArrayBuffer(8))", "/value/g",
])("rejects mutable built-ins from another realm: %s", expression => {
    const value = runInNewContext(expression);
    expect(() => new GlobalStore({nested: value})).toThrow("mutable built-in");
});

it("accepts objects and arrays from another realm", () => {
    const value = runInNewContext("({nested: [{count: 1}]})");
    const store = new GlobalStore(value);
    expect(store.get()).toBe(value);
    expect(() => { value.nested[0].count++; }).toThrow(TypeError);
});
