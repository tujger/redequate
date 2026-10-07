import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import AvatarView from "../../components/AvatarView";
import Titlebar from "../../layouts/BottomToolbarLayout/Titlebar";
import styles from "../../layouts/BottomToolbarLayout/styles/Titlebar.module.css";
import baseStyles from "../../themes/Base.module.css";

let mockPathname;
let mockUser;
const mockGoBack = jest.fn();
const mockPages = {
    home: {label: "Home", route: "/home"},
    login: {label: "Sign in", route: "/login"},
    notfound: {label: "Not found", route: "/404"},
    private: {roles: ["login"], route: "/private", title: "Private"},
    profile: {label: "Profile", route: "/profile"},
    restricted: {roles: ["blocked"], route: "/restricted", title: "Restricted"},
};

jest.mock("@mui/icons-material/ChevronLeft", () => () => <span data-testid="back-icon"/>, {virtual: true});
jest.mock("react-router-dom", () => {
    const React = require("react");
    return {
        Link: ({children, to, ...props}) => React.createElement("a", {...props, href: to}, children),
        useHistory: () => ({goBack: mockGoBack}),
        useLocation: () => ({pathname: mockPathname}),
    };
}, {virtual: true});
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

describe("Titlebar", () => {
    let container;

    beforeEach(() => {
        mockPathname = "/home";
        mockUser = {id: "user", role: "user", initials: "UU", verified: true};
        mockGoBack.mockClear();
        AvatarView.mockClear();
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    const show = props => act(() => { render(<Titlebar {...props}/>, container); });

    it("shows the home title, profile link and progress without a back button", () => {
        show({className: "extra"});
        const header = container.querySelector("header");
        expect(header.classList.contains(styles.appbar)).toBe(true);
        expect(header.classList.contains("extra")).toBe(true);
        expect(header.querySelector(`.${styles.toolbar}`)).not.toBeNull();
        expect(header.querySelector("h6").textContent).toBe("Home");
        expect(header.querySelector('[role="button"]')).toBeNull();
        expect(header.querySelector('[data-testid="progress"]')).not.toBeNull();

        const profile = header.querySelector('a[href="/profile"]');
        expect(profile).not.toBeNull();
        expect(AvatarView.mock.calls[0][0]).toMatchObject({admin: false, initials: "UU", verified: true});
        act(() => { Simulate.pointerDown(profile, {clientX: 10, clientY: 12}); });
        expect(profile.classList.contains(baseStyles.ripple)).toBe(true);
    });

    it("goes back by click or keyboard while keeping the ChevronLeft icon", () => {
        mockPathname = "/profile";
        show({});
        const button = container.querySelector('[role="button"]');
        expect(button.getAttribute("aria-label")).toBe("go back");
        expect(button.querySelector('[data-testid="back-icon"]')).not.toBeNull();
        act(() => { button.click(); });
        act(() => { Simulate.keyDown(button, {key: "Enter"}); });
        expect(mockGoBack).toHaveBeenCalledTimes(2);
        expect(container.querySelector("h6").textContent).toBe("Profile");
    });

    it("shows the login or not-found title for inaccessible routes and omits an anonymous avatar", () => {
        mockUser = {id: null, role: "guest"};
        mockPathname = "/private";
        show({});
        expect(container.querySelector("h6").textContent).toBe("Sign in");
        expect(container.querySelector('a[href="/profile"]')).toBeNull();

        mockPathname = "/restricted";
        show({});
        expect(container.querySelector("h6").textContent).toBe("Not found");
    });
});
