import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import ProgressView, {progressViewReducer} from "../../components/ProgressView";
import styles from "../../components/styles/ProgressView.module.css";

describe("ProgressView", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        unmountComponentAtNode(container);
        container.remove();
    });

    const renderProgress = (state, props = {}) => {
        act(() => {
            render(<ProgressView {...state} {...props}/>, container);
        });
        return container.firstChild;
    };

    it("shows an indeterminate bar without a numeric value", () => {
        const state = progressViewReducer(undefined, ProgressView.SHOW);
        const progress = renderProgress(state);

        expect(progress.getAttribute("role")).toBe("progressbar");
        expect(progress.hasAttribute("aria-valuenow")).toBe(false);
        expect(progress.children).toHaveLength(2);
        expect(progress.classList.contains(styles.hidden)).toBe(false);
    });

    it("shows a determinate percentage", () => {
        const state = progressViewReducer(undefined, {...ProgressView.SHOW, value: 20});
        const progress = renderProgress(state);

        expect(state.value).toBe(20);
        expect(progress.getAttribute("aria-valuenow")).toBe("20");
        expect(progress.children).toHaveLength(1);
    });

    it("hides the bar while keeping a custom class", () => {
        const shown = progressViewReducer(undefined, ProgressView.SHOW);
        renderProgress(shown, {className: "custom-progress"});
        const hidden = progressViewReducer(shown, ProgressView.HIDE);
        const progress = renderProgress(hidden, {className: "custom-progress"});

        expect(progress.classList.contains(styles.hidden)).toBe(true);
        expect(progress.classList.contains("custom-progress")).toBe(true);
    });
});
