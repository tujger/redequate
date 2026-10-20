import AppProvider from "../../../controllers/AppContext/AppContext";
import useAuth from "../../../controllers/AppContext/useAuth";
import React from "react";
import {vi} from "vitest";
import {render, unmount} from "../../render";

it("uses the nearest AppContext provider and follows value updates", () => {
    const outer = {};
    const inner = {};
    const updated = {};
    const observed = [];
    const container = document.createElement("div");
    const Probe = () => { observed.push(useAuth()); return null; };
    const tree = instance => React.createElement(AppProvider, {value: {auth: instance}},
        React.createElement(Probe),
        React.createElement(AppProvider, {value: {auth: inner}}, React.createElement(Probe)),
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
    const Probe = () => { useAuth(); return null; };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const element = scenario === "outside"
        ? React.createElement(Probe)
        : React.createElement(AppProvider, {value: scenario === "missing service" ? {} : {auth: null}}, React.createElement(Probe));
    try {
        expect(() => render(element, container)).toThrow("useAuth requires a Dispatcher Auth provider");
    } finally { unmount(container); }
});
