import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import MainContent from "../../components/MainContent";
import BottomToolbarLayout from "../../layouts/BottomToolbarLayout/BottomToolbarLayout";
import styles from "../../layouts/BottomToolbarLayout/styles/BottomToolbarLayout.module.css";

vi.mock("../../components/MainContent", () => ({ default: vi.fn(() => null) }));
vi.mock("../../layouts/BottomToolbarLayout/BottomToolbar", () => ({ default: vi.fn(() => null) }));
vi.mock("../../layouts/BottomToolbarLayout/Titlebar", () => ({ default: () => null }));
vi.mock("../../components/Snackbar", () => ({ default: () => null }));
vi.mock("../../controllers/Notifications", () => ({ NotificationsSnackbar: () => null }));
vi.mock("../../components/DispatchedConfirmComponent", () => ({ default: () => null }));

describe("BottomToolbarLayout", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    MainContent.mockClear();
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
  });

  it("keeps the toolbar marker and passes layout classes to page content", () => {
    act(() => {
      render(<BottomToolbarLayout footerComponent={<span>Footer</span>} menu={[]} />, container);
    });

    const root = container.firstChild;
    expect(root.classList.contains(styles.container)).toBe(true);
    expect(root.hasAttribute("data-bottom-toolbar")).toBe(true);
    const indent = root.querySelector(`.${styles.indent}`);
    expect(indent.tagName).toBe("DIV");
    expect(indent.getAttribute("aria-hidden")).toBe("true");
    expect(root.textContent).toContain("Footer");
    const classes = MainContent.mock.calls[0][0].classes;
    expect(Object.values(classes).every(Boolean)).toBe(true);
    expect(classes).toEqual({
      bottom: styles.bottom,
      bottomSticky: styles.bottomSticky,
      center: styles.center,
      left: styles.left,
      right: styles.right,
      top: styles.top,
      topSticky: styles.topSticky
    });
  });
});
