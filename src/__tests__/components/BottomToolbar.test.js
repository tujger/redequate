import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import BottomToolbar from "../../layouts/BottomToolbarLayout/BottomToolbar";

let mockPathname = "/home";
const mockPush = jest.fn();

jest.mock("react-router-dom", () => {
    const React = require("react");
    return {
        Link: ({children, to, ...props}) => React.createElement("a", {...props, href: to}, children),
        matchPath: (pathname, {path}) => pathname === path ? {path} : null,
        useHistory: () => ({push: mockPush}),
        useLocation: () => ({pathname: mockPathname}),
    };
});
jest.mock("../../controllers/UserData", () => ({
    matchRole: () => true,
    useCurrentUserData: () => ({id: "user"}),
}));

describe("BottomToolbar", () => {
    let container;
    const items = [
        [
            {label: "Home", route: "/home", _route: "/home", icon: "home"},
            {label: "Details", route: "/details", _route: "/details", component: true},
        ],
        [
            {label: "Other", route: "/other", _route: "/other", icon: "other"},
            {label: "More", route: "/more", _route: "/more", component: true},
        ],
    ];

    beforeEach(() => {
        mockPathname = "/home";
        mockPush.mockClear();
        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => { render(<BottomToolbar items={items}/>, container); });
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    it("reserves space with one non-interactive placeholder and navigates to another section", () => {
        expect(container.firstChild.getAttribute("aria-hidden")).toBe("true");
        const actions = container.querySelectorAll("nav [role=button]");
        expect(actions).toHaveLength(2);

        act(() => { Simulate.click(actions[1]); });
        expect(mockPush).toHaveBeenCalledWith("/other");
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("opens the current section's menu and closes after selecting a link", () => {
        const current = container.querySelector("nav [role=button]");
        act(() => { Simulate.click(current); });
        act(() => { Simulate.click(current); });
        expect(document.querySelector('[role="menu"]')).toBeNull();

        act(() => { Simulate.click(current); });
        const menu = document.querySelector('[role="menu"]');
        expect(menu.parentElement).toBe(document.body);
        expect(menu.textContent).toContain("Details");
        expect(menu.textContent).not.toContain("More");

        act(() => { Simulate.click(menu.querySelector("a")); });
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("opens on context menu and closes on outside pointer or Escape", () => {
        const other = container.querySelectorAll("nav [role=button]")[1];
        act(() => { Simulate.contextMenu(other); });
        expect(document.querySelector('[role="menu"]').textContent).toContain("More");

        act(() => { document.body.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true})); });
        expect(document.querySelector('[role="menu"]')).toBeNull();

        act(() => { Simulate.contextMenu(other); });
        act(() => { document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true})); });
        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(document.activeElement).toBe(other);
    });

    it("positions the menu above its trigger and updates it on scroll", () => {
        const trigger = container.querySelector("nav [role=button]");
        let top = 150;
        trigger.getBoundingClientRect = () => ({left: 100, right: 180, top, bottom: top + 40, width: 80});
        act(() => { Simulate.click(trigger); });
        const menu = document.querySelector('[role="menu"]');
        Object.defineProperties(menu, {
            offsetWidth: {configurable: true, value: 120},
            scrollHeight: {configurable: true, value: 200},
        });

        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.left).toBe("80px");
        expect(menu.style.top).toBe("190px");
        expect(menu.style.maxHeight).toBe(`${window.innerHeight - 198}px`);
        expect(menu.style.overflowY).toBe("");

        top = 250;
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.top).toBe("50px");
        expect(menu.style.maxHeight).toBe("242px");

        top = 300;
        act(() => { window.dispatchEvent(new Event("resize")); });
        expect(menu.style.top).toBe("100px");
    });

    it("navigates with arrows and activates a button only once with Enter", () => {
        const action = jest.fn();
        const withActions = [[
            items[0][0],
            {label: "Disabled", disabled: true},
            {label: "First", onClick: action},
            {label: "Second", onClick: action},
        ]];
        act(() => { render(<BottomToolbar items={withActions}/>, container); });
        const trigger = container.querySelector("nav [role=button]");
        act(() => { Simulate.click(trigger); });
        const menu = document.querySelector('[role="menu"]');
        const entries = menu.querySelectorAll('[role="menuitem"]');
        expect(entries).toHaveLength(2);
        expect(document.activeElement).toBe(entries[0]);

        act(() => { Simulate.keyDown(entries[0], {key: "ArrowDown"}); });
        expect(document.activeElement).toBe(entries[1]);
        act(() => { Simulate.keyDown(entries[1], {key: "Enter"}); });
        expect(action).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });
});
