import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import AvatarView from "../../components/AvatarView";
import MainAppbar from "../../layouts/ResponsiveDrawerLayout/MainAppbar";
import styles from "../../layouts/ResponsiveDrawerLayout/styles/MainAppbar.module.css";
import baseStyles from "../../themes/Base.module.css";

let mockUser;
let mockPathname;
const mockPages = {
    home: {label: "Home", _route: "/home", route: "/home"},
    login: {label: "Sign in", _route: "/login", route: "/login"},
    notfound: {label: "Not found", _route: "/404", route: "/404"},
    private: {roles: ["login"], _route: "/private", route: "/private", title: "Private"},
    profile: {label: "Profile", _route: "/profile", route: "/profile"},
    restricted: {roles: ["blocked"], _route: "/restricted", route: "/restricted", title: "Restricted"},
    search: {component: {type: () => <span data-testid="search"/>}},
};

jest.mock("@material-ui/icons/Menu", () => () => <span data-testid="menu-icon"/>);
jest.mock("react-router-dom", () => {
    const React = require("react");
    return {
        Link: ({children, to, ...props}) => React.createElement("a", {...props, href: to}, children),
        Route: ({children}) => children,
        Switch: ({children}) => React.Children.toArray(children)
            .find(child => child.props.path === mockPathname) || null,
    };
});
jest.mock("react-redux", () => ({connect: () => Component => Component}));
jest.mock("../../controllers/General", () => ({usePages: () => mockPages}));
jest.mock("../../controllers/UserData", () => ({
    currentRole: user => user.role,
    matchRole: roles => !roles?.includes("blocked"),
    needAuth: roles => Boolean(roles?.includes("login")),
    Role: {ADMIN: "admin"},
    useCurrentUserData: () => mockUser,
}));
jest.mock("../../components/AvatarView", () => jest.fn(() => <span data-testid="avatar"/>));
jest.mock("../../components/ProgressView", () => () => <div data-testid="progress"/>);

describe("MainAppbar", () => {
    let container;

    beforeEach(() => {
        mockUser = {id: "user", role: "admin", initials: "UU", verified: true};
        AvatarView.mockClear();
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    const show = (path, props = {}) => {
        mockPathname = path;
        act(() => { render(<MainAppbar {...props}/>, container); });
    };

    it("shows the drawer button at desktop width and keeps the title, search, profile and progress", () => {
        const onHamburgerClick = jest.fn();
        const originalWidth = window.innerWidth;
        Object.defineProperty(window, "innerWidth", {configurable: true, value: 1280});
        try {
            show("/home", {badge: 2, className: "extra", onHamburgerClick});
            const header = container.querySelector("header");
            const toolbar = header.querySelector(`.${styles.toolbar}`);
            const button = toolbar.querySelector('button[aria-label="open drawer"]');
            const home = toolbar.querySelector('a[href="/home"]');
            const profile = toolbar.querySelector('a[href="/profile"]');

            expect(header.classList.contains(styles.appbar)).toBe(true);
            expect(toolbar.classList.contains("extra")).toBe(true);
            expect(button.querySelector('[data-testid="menu-icon"]')).not.toBeNull();
            expect(button.querySelector(`.${styles.badge}`)).not.toBeNull();
            expect(home.textContent).toBe("Home");
            expect(toolbar.querySelector('[data-testid="search"]')).not.toBeNull();
            expect(profile.querySelector('[data-testid="avatar"]')).not.toBeNull();
            expect(AvatarView.mock.calls[0][0]).toMatchObject({admin: true, initials: "UU", verified: true});
            expect(header.querySelector('[data-testid="progress"]')).not.toBeNull();

            act(() => { Simulate.pointerDown(button, {clientX: 12, clientY: 12}); });
            expect(button.classList.contains(baseStyles.ripple)).toBe(true);
            act(() => { button.click(); });
            expect(onHamburgerClick).toHaveBeenCalledTimes(1);
            act(() => { Simulate.pointerDown(home, {clientX: 10, clientY: 10}); });
            act(() => { Simulate.pointerDown(profile, {clientX: 10, clientY: 10}); });
            expect(home.classList.contains(baseStyles.ripple)).toBe(true);
            expect(profile.classList.contains(baseStyles.ripple)).toBe(true);

            Object.defineProperty(window, "innerWidth", {configurable: true, value: 375});
            show("/home", {badge: 0, onHamburgerClick});
            expect(container.querySelector('button[aria-label="open drawer"]')).not.toBeNull();
            expect(container.querySelector(`.${styles.badge}`)).toBeNull();
        } finally {
            Object.defineProperty(window, "innerWidth", {configurable: true, value: originalWidth});
        }
    });

    it("shows a logo in the title link and hides optional controls when absent", () => {
        mockUser = {id: null, role: "guest"};
        show("/home", {logo: "/logo.png"});
        const header = container.querySelector("header");
        expect(header.querySelector('a[href="/home"] img').getAttribute("src")).toBe("/logo.png");
        expect(header.querySelector('button[aria-label="open drawer"]')).toBeNull();
        expect(header.querySelector('a[href="/profile"]')).toBeNull();
    });

    it("uses access-aware titles and the not-found route", () => {
        mockUser = {id: null, role: "guest"};
        show("/private");
        expect(container.querySelector("h6").textContent).toBe("Sign in");
        show("/restricted");
        expect(container.querySelector("h6").textContent).toBe("Not found");
        show("/404");
        expect(container.querySelector('h6 a[href="/home"]').textContent).toBe("Not found");
    });
});
