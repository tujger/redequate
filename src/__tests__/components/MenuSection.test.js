import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import MenuSection from "../../layouts/TopBottomMenuLayout/MenuSection";
import menuStyles from "../../controls/Menu/Menu.module.css";

const mockPush = jest.fn();

jest.mock("@material-ui/icons/ArrowRight", () => () => null, {virtual: true});
jest.mock("react-router-dom", () => {
    const React = require("react");
    return {
        Link: ({children, to, ...props}) => React.createElement("a", {...props, href: to}, children),
        useHistory: () => ({push: mockPush}),
    };
});
jest.mock("../../controllers/UserData", () => ({
    matchRole: () => true,
    useCurrentUserData: () => ({id: "user"}),
}));

describe("MenuSection", () => {
    let container;

    beforeEach(() => {
        mockPush.mockClear();
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
        trigger.getBoundingClientRect = () => ({left: 0, top: 10, bottom: 42, right, width: right, height: 32});
        act(() => { Simulate.mouseEnter(trigger); });

        const menu = document.querySelector('[role="menu"]');
        right = 300;
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.left).toBe("300px");

        act(() => { Simulate.keyDown(menu, {key: "Escape"}); });
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("treats a one-item array as a normal action", () => {
        const onClick = jest.fn();
        act(() => {
            render(<MenuSection items={[
                {label: "Section", route: "/section"},
                [{label: "Only", onClick, route: "/only"}],
            ]}/>, container);
        });
        act(() => { container.querySelector('[role="button"]').click(); });
        const item = document.querySelector('[role="menuitem"]');
        expect(item.textContent).toBe("Only");
        expect(item.getAttribute("aria-haspopup")).toBeNull();
        act(() => { item.click(); });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledWith("/only");
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("runs a single section item instead of opening a menu", () => {
        const onClick = jest.fn();
        act(() => {
            render(<MenuSection items={[{label: "Only section", onClick, route: "/only"}]}/>, container);
        });
        act(() => { container.querySelector('[role="button"]').click(); });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledWith("/only");
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("ignores an empty nested array", () => {
        act(() => {
            render(<MenuSection items={[{label: "Section", route: "/section"}, []]}/>, container);
        });
        act(() => { container.querySelector('[role="button"]').click(); });
        expect(mockPush).toHaveBeenCalledWith("/section");
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("opens nested arrays without invoking selector actions and closes after a leaf action", () => {
        const selectorClick = jest.fn();
        const leafClick = jest.fn();
        act(() => {
            render(<MenuSection items={[
                {label: "Section", route: "/section"},
                [{label: "More", onClick: selectorClick},
                    [{label: "Deeper", onClick: selectorClick}, {label: "Leaf", onClick: leafClick}]],
            ]}/>, container);
        });
        act(() => { Simulate.mouseEnter(container.querySelector('[role="button"]')); });
        const more = document.querySelector('[role="menuitem"]');
        act(() => { more.click(); });
        expect(selectorClick).not.toHaveBeenCalled();
        const deeper = document.querySelectorAll('[role="menuitem"]')[1];
        act(() => { deeper.click(); });
        expect(selectorClick).not.toHaveBeenCalled();
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(3);
        act(() => { document.querySelectorAll('[role="menuitem"]')[2].click(); });
        expect(leafClick).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("toggles a mobile submenu on click", () => {
        const width = window.innerWidth;
        Object.defineProperty(window, "innerWidth", {configurable: true, value: 375});
        try {
            act(() => { container.querySelector('[role="button"]').click(); });
            const selector = document.querySelector('[aria-haspopup="menu"][role="menuitem"]');
            act(() => { selector.click(); });
            expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);
            expect(selector.getAttribute("aria-expanded")).toBe("true");
            act(() => { selector.click(); });
            expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
        } finally {
            Object.defineProperty(window, "innerWidth", {configurable: true, value: width});
        }
    });

    it("opens and closes a submenu with arrow keys", () => {
        act(() => { Simulate.keyDown(container.querySelector('[role="button"]'), {key: "ArrowDown"}); });
        const selector = document.querySelector('[aria-haspopup="menu"][role="menuitem"]');
        selector.focus();
        act(() => { Simulate.keyDown(selector, {key: "ArrowRight"}); });
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);
        act(() => { Simulate.keyDown(document.querySelectorAll('[role="menu"]')[1], {key: "ArrowLeft"}); });
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
        expect(document.activeElement).toBe(selector);
    });

    it("places a desktop submenu to the left when there is no room on the right", () => {
        act(() => { container.querySelector('[role="button"]').click(); });
        const selector = document.querySelector('[aria-haspopup="menu"][role="menuitem"]');
        const branch = selector.parentElement;
        branch.getBoundingClientRect = () => ({right: window.innerWidth - 20});
        const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
            configurable: true,
            get() { return this.getAttribute("role") === "menu" ? 200 : 0; },
        });
        try {
            act(() => { selector.click(); });
            expect(branch.classList.contains(menuStyles.openLeft)).toBe(true);
        } finally {
            Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalWidth);
        }
    });
});
