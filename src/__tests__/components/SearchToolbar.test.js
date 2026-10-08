import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import SearchToolbar from "../../pages/search/SearchToolbar";

let mockHistory;

vi.mock("@mui/icons-material/ArrowBack", () => ({ default: () => null }));
vi.mock("@mui/icons-material/Clear", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value) => value })
}));
vi.mock("react-router-dom", () => ({
  useHistory: () => mockHistory
}));
vi.mock("../../controllers/General", () => ({
  usePages: () => ({ search: { icon: null, route: "/search" } })
}));

describe("SearchToolbar", () => {
  let container;
  let unblock;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    unblock = vi.fn();
    mockHistory = {
      block: vi.fn(() => unblock),
      push: vi.fn()
    };
  });

  afterEach(() => {
    unmount(container);
    container.remove();
  });

  it("uses TextField clearing and submits the encoded search value", () => {
    act(() => {
      render(<SearchToolbar />, container);
    });
    act(() => container.querySelector('[role="button"]').click());

    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    act(() => fireEvent.change(input, { target: { value: "whisky & rum" } }));
    act(() => container.querySelector('[title="Clear"]').click());
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);

    act(() => fireEvent.change(input, { target: { value: "whisky & rum" } }));
    act(() => fireEvent.keyUp(input, { key: "Enter" }));
    expect(mockHistory.push).toHaveBeenCalledWith("/search?q=whisky%20%26%20rum");
    expect(unblock).toHaveBeenCalledTimes(1);
    expect(mockHistory.unblock).toBeUndefined();
  });

  it("preserves the custom Input callbacks without managing its clearing", () => {
    const onApply = vi.fn();
    const onChange = vi.fn();
    const onSelect = vi.fn();
    let inputProps;
    const CustomInput = (props) => {
      inputProps = props;
      return <input onChange={props.onChange} onKeyUp={props.onKeyUp} value={props.value} />;
    };

    act(() => {
      render(<SearchToolbar
        Input={<CustomInput onApply={onApply} onChange={onChange} onSelect={onSelect} />}
        transformSearch={(value) => value.toUpperCase()} />,
      container);
    });
    act(() => container.querySelector('[role="button"]').click());

    expect(inputProps.inputRef).toBeUndefined();
    expect(inputProps.endAdornment).toBeUndefined();
    expect(inputProps.onSelect).toBe(onSelect);
    act(() => fireEvent.change(container.querySelector("input"), { target: { value: "tag" } }));
    expect(onChange).toHaveBeenCalledWith("TAG");
    expect(container.querySelector('[title="Clear"]')).toBeNull();

    const buttons = container.querySelectorAll('[role="button"]');
    act(() => buttons[buttons.length - 1].click());
    expect(onApply).toHaveBeenCalledWith("TAG");
    expect(mockHistory.push).not.toHaveBeenCalled();
    expect(unblock).toHaveBeenCalledTimes(1);
  });

  it("closes an externally opened toolbar without a history blocker", () => {
    act(() => {
      render(<SearchToolbar open />, container);
    });
    const buttons = container.querySelectorAll('[role="button"]');
    act(() => buttons[1].click());

    expect(container.querySelector("input")).toBeNull();
    expect(mockHistory.block).not.toHaveBeenCalled();
  });
});
