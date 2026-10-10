import React from "react";
import {vi} from "vitest";
import AuthProvider, {useAuth} from "../AuthContext";
import {render, unmount} from "../../../../src/__tests__/render";

it("uses the nearest provider and preserves independent instances", () => {
    const outer = {};
    const inner = {};
    const observed = [];
    const Probe = () => {
        observed.push(useAuth());
        return null;
    };
    const container = document.createElement("div");
    try {
        render(React.createElement(AuthProvider, {value: outer},
            React.createElement(Probe),
            React.createElement(AuthProvider, {value: inner}, React.createElement(Probe)),
            React.createElement(Probe)), container);
        expect(observed).toEqual([outer, inner, outer]);
    } finally {
        unmount(container);
    }
});
it("fails outside an Auth provider", () => {
    const Probe = () => {
        useAuth();
        return null;
    };
    const container = document.createElement("div");
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
        expect(() => render(React.createElement(Probe), container)).toThrow("useAuth requires a Dispatcher Auth provider");
    } finally {
        unmount(container);
    }
});
