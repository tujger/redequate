import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import Snackbar, { snackbarReducer } from "../../components/Snackbar";

vi.mock("@mui/icons-material/Close", () => ({ default: () => null }));

vi.mock("react-redux", () => ({connect: () => Component => Component}));

describe("Snackbar", () => {
  let container;
  let dispatch;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    dispatch = vi.fn();
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
    vi.useRealTimers();
  });

  const show = (container, dispatch, message = "Saved") => {
    act(() => {
      render(<Snackbar open message={message} buttonText={"Dismiss"} dispatch={dispatch} />, container);
    });
    return container.querySelector('[role="alert"]');
  };

  it("shows the message and closes from either action", () => {
    const snackbar = show(container, dispatch);
    expect(snackbar.textContent).toContain("Saved");
    act(() => {snackbar.querySelectorAll('[role="button"]')[0].click();});
    expect(dispatch).toHaveBeenCalledWith({ type: "snackbar_Hide" });

    dispatch.mockClear();
    act(() => {snackbar.querySelector('[title="Close"]').click();});
    expect(dispatch).toHaveBeenCalledWith({ type: "snackbar_Hide" });

    act(() => {
      render(<Snackbar open={false} message={"Saved"} buttonText={"Dismiss"} dispatch={dispatch} />, container);
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("auto-hides after six seconds and pauses while hovered", () => {
    const snackbar = show(container, dispatch);
    act(() => {vi.advanceTimersByTime(2000);});
    act(() => {fireEvent.mouseOver(snackbar);});
    act(() => {vi.advanceTimersByTime(6000);});
    expect(dispatch).not.toHaveBeenCalled();
    act(() => {fireEvent.mouseOut(snackbar);});
    act(() => {vi.advanceTimersByTime(2999);});
    expect(dispatch).not.toHaveBeenCalled();
    act(() => {vi.advanceTimersByTime(1);});
    expect(dispatch).toHaveBeenCalledWith({ type: "snackbar_Hide" });
  });

  it("pauses on window blur and resumes for three seconds on focus", () => {
    show(container, dispatch);
    act(() => {window.dispatchEvent(new Event("blur"));});
    act(() => {vi.advanceTimersByTime(6000);});
    expect(dispatch).not.toHaveBeenCalled();
    act(() => {window.dispatchEvent(new Event("focus"));});
    act(() => {vi.advanceTimersByTime(3000);});
    expect(dispatch).toHaveBeenCalledWith({ type: "snackbar_Hide" });
  });

  it("preserves the show and hide Redux actions", () => {
    const shown = snackbarReducer(undefined, { type: "snackbar_Show", message: "Saved", buttonText: "Dismiss" });
    expect(shown).toMatchObject({ open: true, message: "Saved", buttonText: "Dismiss" });
    expect(snackbarReducer(shown, { type: "snackbar_Hide" }).open).toBe(false);
  });
});
