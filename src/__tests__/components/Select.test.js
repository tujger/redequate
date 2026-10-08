import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import Select from "../../controls/Select/Select";

vi.mock("@mui/icons-material/ArrowDropDown", () => {
  const React = require("react");
  return { default: (props) => React.createElement("svg", props) };
});
vi.mock("@mui/icons-material/ArrowDropUp", () => {
  const React = require("react");
  return { default: (props) => React.createElement("svg", props) };
});

describe("Select", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    unmount(container);
    container.remove();
  });

  it("selects an option and reports its value", () => {
    const onChange = vi.fn();
    act(() => {
      render(<Select
        onChange={onChange}
        options={[{ label: "All", value: "all" }, { label: "Recent", value: "recent" }]}
        value={"all"} />,
      container);
    });

    expect(container.querySelector('[data-testid="select-arrow-down"]')).not.toBeNull();
    act(() => container.firstChild.click());
    expect(container.querySelector('[data-testid="select-arrow-up"]')).not.toBeNull();
    const menu = document.querySelector('[role="listbox"]');
    expect(menu).not.toBeNull();
    act(() => {
      menu.querySelectorAll('[role="option"]')[1].click();
    });

    expect(onChange.mock.calls[0][0].target.value).toBe("recent");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it("does not render a dropdown arrow for icon menus", () => {
    act(() => {
      render(<Select
        iconMenu
        options={[{ label: "Edit", value: "edit" }]}
        value={""} />,
      container);
    });

    expect(container.querySelector('[data-testid^="select-arrow-"]')).toBeNull();
  });

  it("renders a divider without making it selectable or focusable", () => {
    const onChange = vi.fn();
    act(() => {
      render(<Select
        iconMenu
        onChange={onChange}
        options={[{ label: "First", value: "first" }, "-", { label: "Second", value: "second" }]}
        value="" />,
      container);
    });

    act(() => {container.querySelector('[role="button"]').click();});
    const menu = document.querySelector('[role="menu"]');
    const divider = menu.querySelector('[role="separator"]');
    expect(divider).not.toBeNull();
    expect(divider.hasAttribute("tabindex")).toBe(false);
    expect(divider.hasAttribute("data-select-option")).toBe(false);
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(document.activeElement.textContent).toBe("First");

    act(() => {divider.click();});
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    act(() => {fireEvent.keyDown(menu, { key: "ArrowDown" });});
    expect(document.activeElement.textContent).toBe("Second");
    act(() => {fireEvent.keyDown(menu, { key: "Enter" });});
    expect(onChange.mock.calls[0][0].target.value).toBe("second");
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it("opens and selects with the keyboard", () => {
    const onChange = vi.fn();
    act(() => {
      render(<Select
        onChange={onChange}
        options={[{ label: "All", value: "all" }, { label: "Recent", value: "recent" }]}
        value={"all"} />,
      container);
    });

    const trigger = container.firstChild;
    act(() => {
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
    });
    const menu = document.querySelector('[role="listbox"]');
    expect(menu).not.toBeNull();
    act(() => {
      fireEvent.keyDown(menu, { key: "ArrowDown" });
    });
    act(() => {
      fireEvent.keyDown(menu, { key: "Enter" });
    });

    expect(onChange.mock.calls[0][0].target.value).toBe("recent");
  });

  it("uses an external anchor and obeys controlled open", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const onClose = vi.fn();
    const props = { anchorEl: anchor, onClose, options: [{ label: "Save", value: "save" }], value: "" };

    act(() => {
      render(<Select {...props} open />, container);
    });
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    const backdrop = document.querySelector('[data-testid="select-backdrop"]');
    expect(backdrop).not.toBeNull();
    act(() => backdrop.click());
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      render(<Select {...props} open={false} />, container);
    });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    anchor.remove();
  });

  it("positions a controlled menu when it starts open without an external anchor", () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return this.getAttribute("role") === "combobox" ?
      { left: 40, right: 140, top: 20, bottom: 60, width: 100 } :
      { left: 0, right: 0, top: 0, bottom: 0, width: 0 };
    };
    try {
      act(() => {
        render(<Select open options={[{ label: "Save", value: "save" }]} value="" />, container);
      });
      const menu = document.querySelector('[role="listbox"]');
      expect(menu.style.left).toBe("40px");
      expect(menu.style.minWidth).toBe("100px");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });
});
