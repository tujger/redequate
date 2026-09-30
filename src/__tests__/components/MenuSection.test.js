import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import MenuSection from "../../layouts/TopBottomMenuLayout/MenuSection";

jest.mock("@material-ui/icons/ArrowRight", () => () => null, {virtual: true});
jest.mock("react-router-dom", () => {
    const React = require("react");
    return {
        Link: ({children, to, ...props}) => React.createElement("a", {...props, href: to}, children),
        useHistory: () => ({push: jest.fn()}),
    };
});
jest.mock("../../controllers/UserData", () => ({
    matchRole: () => true,
    useCurrentUserData: () => ({id: "user"}),
}));

describe("MenuSection", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => {
            render(<MenuSection items={[
                {label: "Section", route: "/section"},
                {label: "First", component: true, route: "/first"},
                [{label: "More", route: "/more"}, {label: "Second", component: true, route: "/second"}],
            ]}/>, container);
        });
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    it("keeps the menu in a body portal while moving between the trigger and submenu", () => {
        const trigger = container.querySelector('[role="button"]');
        act(() => { Simulate.mouseEnter(trigger); });

        const menu = document.querySelector('[role="menu"]');
        expect(menu.parentElement).toBe(document.body);
        expect(container.contains(menu)).toBe(false);

        act(() => { Simulate.mouseLeave(container.firstChild, {relatedTarget: menu}); });
        expect(document.querySelector('[role="menu"]')).toBe(menu);

        const nestedTrigger = menu.querySelector('[role="menuitem"]:not(a)');
        act(() => { Simulate.mouseEnter(nestedTrigger); });
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);

        act(() => { document.body.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true})); });
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("updates the portaled menu position on scroll and closes on Escape", () => {
        const trigger = container.querySelector('[role="button"]');
        let right = 200;
        trigger.getBoundingClientRect = () => ({top: 10, bottom: 42, right});
        act(() => { Simulate.mouseEnter(trigger); });

        const menu = document.querySelector('[role="menu"]');
        const setProperty = jest.spyOn(menu.style, "setProperty");

        right = 300;
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(setProperty).toHaveBeenCalledWith("--menu-left", "300px");

        act(() => { Simulate.keyDown(menu, {key: "Escape"}); });
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });
});
