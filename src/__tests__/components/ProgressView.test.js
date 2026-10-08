import React from "react";
import {Provider} from "react-redux";
import {createStore} from "redux";
import { render, unmount } from "../render";
import { act } from "react";
import ProgressView, { progressViewReducer } from "../../components/ProgressView";
import styles from "../../components/styles/ProgressView.module.css";

describe("ProgressView", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    unmount(container);
    container.remove();
  });

  const renderProgress = (state, props = {}) => {
    act(() => {
      const store = createStore(state => state, {progressView: state});
      render(<Provider store={store}><ProgressView {...props}/></Provider>, container);
    });
    return container.firstChild;
  };

  it("updates through Provider and connect subscriptions", () => {
    const store = createStore((state, action) => ({progressView: progressViewReducer(state?.progressView, action)}));
    render(<Provider store={store}><ProgressView/></Provider>, container);
    expect(container.firstChild.classList.contains(styles.hidden)).toBe(true);
    act(() => store.dispatch({...ProgressView.SHOW, value: 60}));
    expect(container.firstChild.getAttribute("aria-valuenow")).toBe("60");
    expect(container.firstChild.classList.contains(styles.hidden)).toBe(false);
    act(() => store.dispatch(ProgressView.HIDE));
    expect(container.firstChild.classList.contains(styles.hidden)).toBe(true);
  });

  it("shows an indeterminate bar without a numeric value", () => {
    const state = progressViewReducer(undefined, ProgressView.SHOW);
    const progress = renderProgress(state);

    expect(progress.getAttribute("role")).toBe("progressbar");
    expect(progress.hasAttribute("aria-valuenow")).toBe(false);
    expect(progress.children).toHaveLength(2);
    expect(progress.classList.contains(styles.hidden)).toBe(false);
  });

  it("shows a determinate percentage", () => {
    const state = progressViewReducer(undefined, { ...ProgressView.SHOW, value: 20 });
    const progress = renderProgress(state);

    expect(state.value).toBe(20);
    expect(progress.getAttribute("aria-valuenow")).toBe("20");
    expect(progress.children).toHaveLength(1);
  });

  it("hides the bar while keeping a custom class", () => {
    const shown = progressViewReducer(undefined, ProgressView.SHOW);
    renderProgress(shown, { className: "custom-progress" });
    const hidden = progressViewReducer(shown, ProgressView.HIDE);
    const progress = renderProgress(hidden, { className: "custom-progress" });

    expect(progress.classList.contains(styles.hidden)).toBe(true);
    expect(progress.classList.contains("custom-progress")).toBe(true);
  });
});
