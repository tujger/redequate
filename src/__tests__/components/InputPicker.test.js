import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import InputPicker from "../../components/DateTimePicker/InputPicker";
import Picker from "../../components/DateTimePicker/Picker";
import modalStyles from "../../components/styles/ModalComponent.module.css";

vi.mock("@mui/icons-material/Clear", () => ({ default: () => <span data-testid="cancel-icon" /> }));
vi.mock("moment", () => ({ default: vi.fn((value) => value) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("react-router-dom", () => ({ useHistory: () => ({ block: () => () => {} }) }));
vi.mock("../../components/DateTimePicker/Picker", () => ({ default: vi.fn(() => <div data-testid="picker" />) }));

describe("InputPicker", () => {
  let container;

  beforeEach(() => {
    Picker.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
  });

  const show = (props) => act(() => {render(<InputPicker {...props} />, container);});
  const input = () => container.querySelector("input");
  const dialog = () => document.querySelector('[role="dialog"]');

  it("opens from the field and applies a single selected date", () => {
    const onChange = vi.fn();
    const date = { format: () => "10/02/2026 2:30 PM" };
    show({ date, label: "When", onChange });
    expect(container.firstChild.tagName).toBe("LABEL");
    expect(input().value).toBe("10/02/2026 2:30 PM");
    expect(input().readOnly).toBe(true);
    expect(input().getAttribute("aria-expanded")).toBe("false");

    act(() => {input().click();});
    expect(dialog()).not.toBeNull();
    expect(dialog().parentElement.classList.contains(modalStyles.anchored)).toBe(true);
    expect(input().getAttribute("aria-expanded")).toBe("true");
    const selected = { format: () => "10/03/2026 9:00 AM" };
    act(() => {Picker.mock.calls[0][0].onChange(selected);});
    expect(onChange).toHaveBeenCalledWith(selected);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it("formats a range and handles the TextField clear action without opening the picker", () => {
    const onChange = vi.fn();
    show({ range: true, start: { format: () => "Start" }, onChange });
    expect(input().value).toBe("Start - n/a");
    const clear = container.querySelector('[title="Clear"]');
    expect(clear.querySelector('[data-testid="cancel-icon"]')).not.toBeNull();
    act(() => {clear.click();});
    expect(onChange).toHaveBeenCalledWith(null, null);
    expect(dialog()).toBeNull();
  });

  it("passes both selected range dates through to onChange", () => {
    const onChange = vi.fn();
    show({ range: true, onChange });
    act(() => {input().click();});
    const start = { format: () => "Start" };
    const end = { format: () => "End" };
    act(() => {Picker.mock.calls[0][0].onChange(start, end);});
    expect(onChange).toHaveBeenCalledWith(start, end);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(input());
  });

  it("opens with the keyboard and closes on Escape or backdrop click", () => {
    show({ onChange: vi.fn() });
    act(() => {fireEvent.keyDown(input(), { key: "ArrowDown" });});
    expect(dialog()).not.toBeNull();
    act(() => {fireEvent.keyDown(dialog(), { key: "Escape" });});
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(input());

    act(() => {input().click();});
    const backdrop = document.querySelector(`.${modalStyles.backdrop}`);
    act(() => {backdrop.click();});
    expect(dialog()).toBeNull();
  });

  it("does not open or show clear when disabled", () => {
    show({ date: { format: () => "Today" }, disabled: true, onChange: vi.fn() });
    expect(input().disabled).toBe(true);
    expect(container.querySelector('[title="Clear"]')).toBeNull();
    act(() => {input().click();});
    expect(dialog()).toBeNull();
  });

  it("closes an open picker when disabled", () => {
    const onChange = vi.fn();
    show({ onChange });
    act(() => {input().click();});
    expect(dialog()).not.toBeNull();
    show({ disabled: true, onChange });
    expect(dialog()).toBeNull();
  });
});
