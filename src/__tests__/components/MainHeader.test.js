import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import MainHeader from "../../layouts/ResponsiveDrawerLayout/MainHeader";
import styles from "../../layouts/ResponsiveDrawerLayout/styles/MainHeader.module.css";
import baseStyles from "../../themes/Base.module.css";

vi.mock("react-router-dom", () => {
  const React = require("react");
  return {
    Link: ({ children, to, ...props }) => React.createElement("a", { ...props, href: to, onClick: event => { event.preventDefault(); props.onClick?.(event); } }, children)
  };
});
vi.mock("../../controllers/General", () => ({
  usePages: () => ({ home: { route: "/home" } })
}));

describe("MainHeader", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
  });

  it("shows the title as a home link over the supplied image with press feedback", () => {
    act(() => {render(<MainHeader title="Example" image="/header.jpg" />, container);});

    const header = container.firstElementChild;
    const link = header.querySelector("a");
    expect(header.classList.contains(styles.header)).toBe(true);
    expect(header.style.backgroundImage).toBe('url("/header.jpg")');
    expect(link.textContent).toBe("Example");
    expect(link.getAttribute("href")).toBe("/home");

    act(() => {fireEvent.pointerDown(link, { clientX: 10, clientY: 12 });});
    expect(link.classList.contains(baseStyles.ripple)).toBe(true);
  });

  it("renders without a background image when none is supplied", () => {
    act(() => {render(<MainHeader title="Example" />, container);});
    expect(container.firstElementChild.style.backgroundImage).toBe("");
  });
});
