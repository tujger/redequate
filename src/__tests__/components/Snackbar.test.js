import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import Snackbar, {snackbarReducer} from "../../components/Snackbar";

jest.mock("@material-ui/icons/Close", () => () => null, {virtual: true});

describe("Snackbar", () => {
    let container;
    let dispatch;

    beforeEach(() => {
        jest.useFakeTimers();
        container = document.createElement("div");
        document.body.appendChild(container);
        dispatch = jest.fn();
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
        jest.useRealTimers();
    });

    const show = (container, dispatch, message = "Saved") => {
        act(() => {
            render(<Snackbar open message={message} buttonText={"Dismiss"} dispatch={dispatch}/>, container);
        });
        return container.querySelector('[role="alert"]');
    };

    it("shows the message and closes from either action", () => {
        const snackbar = show(container, dispatch);
        expect(snackbar.textContent).toContain("Saved");
        act(() => { snackbar.querySelectorAll('[role="button"]')[0].click(); });
        expect(dispatch).toHaveBeenCalledWith({type: "snackbar_Hide"});

        dispatch.mockClear();
        act(() => { snackbar.querySelector('[title="Close"]').click(); });
        expect(dispatch).toHaveBeenCalledWith({type: "snackbar_Hide"});

        act(() => {
            render(<Snackbar open={false} message={"Saved"} buttonText={"Dismiss"} dispatch={dispatch}/>, container);
        });
        expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    it("auto-hides after six seconds and pauses while hovered", () => {
        const snackbar = show(container, dispatch);
        act(() => { jest.advanceTimersByTime(2000); });
        act(() => { Simulate.mouseEnter(snackbar); });
        act(() => { jest.advanceTimersByTime(6000); });
        expect(dispatch).not.toHaveBeenCalled();
        act(() => { Simulate.mouseLeave(snackbar); });
        act(() => { jest.advanceTimersByTime(2999); });
        expect(dispatch).not.toHaveBeenCalled();
        act(() => { jest.advanceTimersByTime(1); });
        expect(dispatch).toHaveBeenCalledWith({type: "snackbar_Hide"});
    });

    it("pauses on window blur and resumes for three seconds on focus", () => {
        show(container, dispatch);
        act(() => { window.dispatchEvent(new Event("blur")); });
        act(() => { jest.advanceTimersByTime(6000); });
        expect(dispatch).not.toHaveBeenCalled();
        act(() => { window.dispatchEvent(new Event("focus")); });
        act(() => { jest.advanceTimersByTime(3000); });
        expect(dispatch).toHaveBeenCalledWith({type: "snackbar_Hide"});
    });

    it("preserves the show and hide Redux actions", () => {
        const shown = snackbarReducer(undefined, {type: "snackbar_Show", message: "Saved", buttonText: "Dismiss"});
        expect(shown).toMatchObject({open: true, message: "Saved", buttonText: "Dismiss"});
        expect(snackbarReducer(shown, {type: "snackbar_Hide"}).open).toBe(false);
    });
});
