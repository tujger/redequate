import React from "react";
import {vi} from "vitest";
import Base from "../MessagingBase";
import Provider, {useMessaging} from "../MessagingContext";
import LocalTest from "../local-test";
import {resolveMessaging} from "../resolveMessaging";
import {render, unmount} from "../../../../src/__tests__/render";

it("exposes abstract operations with rejected promises", async () => {
    for (const method of ["addMessageListener", "checkIfSubscribed", "subscribe", "unsubscribe"]) {
        await expect(new Base()[method]({})).rejects.toThrow(`Not implemented: ${method}`);
    }
});
it("resolves local defaults and preserves explicit providers", async () => {
    expect(await resolveMessaging()).toBeInstanceOf(LocalTest);
    const provider = new LocalTest();
    expect(await resolveMessaging(provider)).toBe(provider);
    for (const value of [null, [], 1, "invalid"]) await expect(resolveMessaging(value)).rejects.toThrow("Dispatcher messaging");
    delete window.redequateMessaging;
});
it("uses the nearest provider and rejects a missing provider", () => {
    const observed = [];
    const outer = {};
    const inner = {};
    const container = document.createElement("div");
    const Probe = () => { observed.push(useMessaging()); return null; };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
        render(React.createElement(Provider, {value: outer}, React.createElement(Probe),
            React.createElement(Provider, {value: inner}, React.createElement(Probe)), React.createElement(Probe)), container);
        expect(observed).toEqual([outer, inner, outer]);
        unmount(container);
        expect(() => render(React.createElement(Probe), container)).toThrow("useMessaging requires a Dispatcher Messaging provider");
    } finally { unmount(container); error.mockRestore(); }
});
