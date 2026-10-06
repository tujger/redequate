import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import MainMenu from "../../layouts/ResponsiveDrawerLayout/MainMenu";
import styles from "../../layouts/ResponsiveDrawerLayout/styles/MainMenu.module.css";
import baseStyles from "../../themes/Base.module.css";

jest.mock("react-router-dom", () => {
    const React = require("react");
    return {
        Link: ({children, to, ...props}) => React.createElement("a", {...props, href: to}, children),
    };
});
jest.mock("../../controllers/UserData", () => ({
    matchRole: roles => roles !== "blocked",
    useCurrentUserData: () => ({id: "user"}),
}));
jest.mock("../../components/LanguageComponent", () => () => <span data-testid="language"/>);

describe("MainMenu", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    it("skips only a first item whose route matches the next visible item", () => {
        const headingClick = jest.fn();
        const closeDrawer = jest.fn();
        act(() => {
            render(<MainMenu onClick={closeDrawer} items={[
                [{label: "Duplicate", route: "/same"}, {label: "Actual", component: true, route: "/same"}],
                [{label: "Heading", onClick: headingClick, route: "/heading"},
                    {label: "Other", component: true, route: "/other"}],
                [{label: "Unavailable", disabled: true, route: "/disabled"}],
            ]}/>, container);
        });

        const menu = container.querySelector('[role="menu"]');
        expect(container.querySelectorAll('[role="menu"]')).toHaveLength(1);
        expect(Array.from(menu.children).map(child => child.getAttribute("role")))
            .toEqual(["menuitem", "separator", "menuitem", "menuitem", "separator"]);
        expect(menu.textContent).toBe("ActualHeadingOther");
        expect(menu.querySelectorAll(`.${styles.section}`)).toHaveLength(2);
        expect(container.querySelector('[data-testid="language"]')).not.toBeNull();

        const heading = menu.querySelectorAll('[role="menuitem"]')[1];
        expect(heading.tabIndex).toBe(0);
        act(() => { heading.click(); });
        expect(headingClick).toHaveBeenCalledTimes(1);
        expect(closeDrawer).toHaveBeenCalledTimes(1);
    });

    it("shows nested entries without selectors and keeps link actions and ripple", () => {
        const itemClick = jest.fn();
        const closeDrawer = jest.fn();
        act(() => {
            render(<MainMenu onClick={closeDrawer} items={[
                [
                    {label: "First", route: "/first"},
                    [{label: "Hidden group", route: "/group"},
                        {label: "Visible", component: true, icon: <span>Icon</span>,
                            onClick: itemClick, route: "/visible", adornment: () => <b>Badge</b>},
                        [{label: "Hidden inner"}, {label: "Deep", component: true, route: "/deep"}]],
                    {label: "Blocked", roles: "blocked", route: "/blocked"},
                    {label: "Disabled", disabled: true, route: "/disabled"},
                ],
            ]}/>, container);
        });

        const menu = container.querySelector('[role="menu"]');
        expect(container.querySelectorAll('[role="menu"]')).toHaveLength(1);
        expect(menu.querySelectorAll('[role="group"]')).toHaveLength(2);
        expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
        expect(menu.textContent).toContain("IconVisibleBadge");
        expect(menu.textContent).toContain("Deep");
        expect(menu.textContent).not.toMatch(/Hidden|Blocked|Disabled/);

        const link = menu.querySelector('a[href="/visible"]');
        act(() => { Simulate.pointerDown(link, {clientX: 10, clientY: 12}); });
        expect(link.classList.contains(baseStyles.ripple)).toBe(true);
        act(() => { link.click(); });
        expect(itemClick).toHaveBeenCalledTimes(1);
        expect(closeDrawer).toHaveBeenCalledTimes(1);
    });
});
