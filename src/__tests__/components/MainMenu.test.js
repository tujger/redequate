import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import MainMenu from "../../layouts/ResponsiveDrawerLayout/MainMenu";
import styles from "../../layouts/ResponsiveDrawerLayout/styles/MainMenu.module.css";
import baseStyles from "../../themes/Base.module.css";

vi.mock("react-router-dom", () => {
  const React = require("react");
  return {
    Link: ({ children, to, ...props }) => React.createElement("a", { ...props, href: to, onClick: event => { event.preventDefault(); props.onClick?.(event); } }, children)
  };
});
vi.mock("../../controllers/UserData", () => ({
  matchRole: (roles) => roles !== "blocked",
  useCurrentUserData: () => ({ id: "user" })
}));
vi.mock("../../components/LanguageComponent", () => ({ default: () => <span data-testid="language" /> }));

describe("MainMenu", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
  });

  it("skips only a first item whose route matches the next visible item", () => {
    const headingClick = vi.fn();
    const closeDrawer = vi.fn();
    act(() => {
      render(<MainMenu onClick={closeDrawer} items={[
      [{ label: "Duplicate", route: "/same" }, { label: "Actual", component: true, route: "/same" }],
      [{ label: "Heading", onClick: headingClick, route: "/heading" },
      { label: "Other", component: true, route: "/other" }],
      [{ label: "Unavailable", disabled: true, route: "/disabled" }]]
      } />, container);
    });

    const menu = container.querySelector('[role="menu"]');
    expect(container.querySelectorAll('[role="menu"]')).toHaveLength(1);
    expect(Array.from(menu.children).map((child) => child.getAttribute("role"))).
    toEqual(["menuitem", "separator", "menuitem", "menuitem", "separator"]);
    expect(menu.textContent).toBe("ActualHeadingOther");
    expect(menu.querySelectorAll(`.${styles.section}`)).toHaveLength(2);
    expect(container.querySelector('[data-testid="language"]')).not.toBeNull();

    const heading = menu.querySelectorAll('[role="menuitem"]')[1];
    expect(heading.tabIndex).toBe(0);
    act(() => {heading.click();});
    expect(headingClick).toHaveBeenCalledTimes(1);
    expect(closeDrawer).toHaveBeenCalledTimes(1);
  });

  it("shows nested leaves without selectors and keeps link actions and ripple", () => {
    const itemClick = vi.fn();
    const closeDrawer = vi.fn();
    act(() => {
      render(<MainMenu onClick={closeDrawer} items={[
      [
      { label: "First", route: "/first" },
      [{ label: "Hidden group", route: "/group" },
      { label: "Visible", component: true, icon: <span>Icon</span>,
        onClick: itemClick, route: "/visible", adornment: () => <b>Badge</b> },
      [{ label: "Hidden inner" }, { label: "Deep", component: true, route: "/deep" }]],
      { label: "Blocked", roles: "blocked", route: "/blocked" },
      { label: "Disabled", disabled: true, route: "/disabled" }]]

      } />, container);
    });

    const menu = container.querySelector('[role="menu"]');
    expect(container.querySelectorAll('[role="menu"]')).toHaveLength(1);
    expect(menu.querySelector('[aria-haspopup="menu"]')).toBeNull();
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(menu.textContent).toContain("IconVisibleBadge");
    expect(document.body.textContent).toContain("Deep");
    expect(document.body.textContent).not.toMatch(/Blocked|Disabled/);

    const link = document.querySelector('a[href="/visible"]');
    act(() => {fireEvent.pointerDown(link, { clientX: 10, clientY: 12 });});
    expect(link.classList.contains(baseStyles.ripple)).toBe(true);
    act(() => {link.click();});
    expect(itemClick).toHaveBeenCalledTimes(1);
    expect(closeDrawer).toHaveBeenCalledTimes(1);
  });
});
