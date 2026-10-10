import Firebase from "../firebase";
import useMessaging from "../useMessaging";
import AppProvider from "../../../_common/AppContext";
import React from "react";
import {vi} from "vitest";
import Base from "../MessagingBase";

import LocalTest from "../local-test";
import {resolveMessaging} from "../resolveMessaging";
import {render, unmount} from "../../../../src/__tests__/render";

it("exposes abstract operations with rejected promises", async () => {
    for (const method of ["addMessageListener", "checkIfSubscribed", "subscribe", "unsubscribe"]) {
        await expect(new Base()[method]({})).rejects.toThrow(`Not implemented: ${method}`);
    }
});
it("resolves local defaults and preserves explicit providers", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const first = await resolveMessaging();
    const second = await resolveMessaging();
    expect(first).toBeInstanceOf(LocalTest);
    expect(second).toBeInstanceOf(LocalTest);
    expect(second).not.toBe(first);
    const provider = new LocalTest();
    expect(await resolveMessaging(provider)).toBe(provider);
    for (const value of [null, [], 1, "invalid"]) await expect(resolveMessaging(value)).rejects.toThrow("Dispatcher messaging");
    const structural = {operation: vi.fn()};
    expect(await resolveMessaging(structural)).toBe(structural);
    expect(structural.operation).not.toHaveBeenCalled();
    const sdk = {};
    const explicit = new Firebase({firebase: sdk});
    expect(await resolveMessaging(explicit)).toBe(explicit);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    delete window.redequateMessaging;
});

it("uses the nearest AppContext provider and follows value updates", () => {
    const outer = {};
    const inner = {};
    const updated = {};
    const observed = [];
    const container = document.createElement("div");
    const Probe = () => { observed.push(useMessaging()); return null; };
    const tree = instance => React.createElement(AppProvider, {value: {messaging: instance}},
        React.createElement(Probe),
        React.createElement(AppProvider, {value: {messaging: inner}}, React.createElement(Probe)),
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
    const Probe = () => { useMessaging(); return null; };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const element = scenario === "outside"
        ? React.createElement(Probe)
        : React.createElement(AppProvider, {value: scenario === "missing service" ? {} : {messaging: null}}, React.createElement(Probe));
    try {
        expect(() => render(element, container)).toThrow("useMessaging requires a Dispatcher Messaging provider");
    } finally { unmount(container); }
});
