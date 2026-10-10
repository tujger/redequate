import Firebase from "../firebase";
import useStorage from "../useStorage";
import AppProvider from "../../../_common/AppContext";
import React from "react";
import {vi} from "vitest";
import Base from "../StorageBase";

import LocalTest from "../local-test";
import {resolveStorage} from "../resolveStorage";
import {render, unmount} from "../../../../src/__tests__/render";

it("exposes abstract operations with rejected promises", async () => {
    for (const method of ["upload", "resolveDownloadURL", "resolveMetadata", "delete"]) {
        await expect(new Base()[method]({})).rejects.toThrow(`Not implemented: ${method}`);
    }
});
it("resolves local defaults and preserves explicit providers", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const first = await resolveStorage();
    const second = await resolveStorage();
    expect(first).toBeInstanceOf(LocalTest);
    expect(second).toBeInstanceOf(LocalTest);
    expect(second).not.toBe(first);
    const provider = new LocalTest();
    expect(await resolveStorage(provider)).toBe(provider);
    for (const value of [null, [], 1, "invalid"]) await expect(resolveStorage(value)).rejects.toThrow("Dispatcher storage");
    const structural = {operation: vi.fn()};
    expect(await resolveStorage(structural)).toBe(structural);
    expect(structural.operation).not.toHaveBeenCalled();
    const sdk = {};
    const explicit = new Firebase({firebase: sdk});
    expect(await resolveStorage(explicit)).toBe(explicit);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
});

it("uses the nearest AppContext provider and follows value updates", () => {
    const outer = {};
    const inner = {};
    const updated = {};
    const observed = [];
    const container = document.createElement("div");
    const Probe = () => { observed.push(useStorage()); return null; };
    const tree = instance => React.createElement(AppProvider, {value: {storage: instance}},
        React.createElement(Probe),
        React.createElement(AppProvider, {value: {storage: inner}}, React.createElement(Probe)),
        React.createElement(Probe));
    try {
        render(tree(outer), container);
        expect(observed).toEqual([outer, inner, outer]);
        observed.length = 0;
        render(tree(updated), container);
        expect(observed).toEqual([updated, inner, updated]);
    } finally { unmount(container); }
});
it.each(["outside", "missing service", "null service"])("rejects %s in AppContext", scenario => {
    const container = document.createElement("div");
    const Probe = () => { useStorage(); return null; };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const element = scenario === "outside"
        ? React.createElement(Probe)
        : React.createElement(AppProvider, {value: scenario === "missing service" ? {} : {storage: null}}, React.createElement(Probe));
    try {
        expect(() => render(element, container)).toThrow("useStorage requires a Dispatcher Storage provider");
    } finally { unmount(container); }
});
