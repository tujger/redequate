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
    });
});
