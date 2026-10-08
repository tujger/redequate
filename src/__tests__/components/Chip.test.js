import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import Chip from "../../controls/Chip/Chip";

vi.mock("@mui/icons-material/Cancel", () => {
  const React = require("react");
  return { default: (props) => React.createElement("svg", props) };
});

describe("Chip", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    unmount(container);
    container.remove();
  });

  it("renders an avatar and label and calls onDelete without bubbling", () => {
    const onDelete = vi.fn();
    const onParentClick = vi.fn();
    act(() => {
      render(<div onClick={onParentClick}>
                <Chip
          avatar={<span>U</span>}
          label={"User"}
          onDelete={onDelete} />

            </div>, container);
    });

    expect(container.textContent).toContain("U");
    expect(container.textContent).toContain("User");
    act(() => container.querySelector('[role="button"]').click());

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("renders a secondary label without a delete action", () => {
    act(() => {
      render(<Chip color={"secondary"} label={"Needs select type"} />, container);
    });

    expect(container.textContent).toBe("Needs select type");
    expect(container.querySelector('[role="button"]')).toBeNull();
  });
});
