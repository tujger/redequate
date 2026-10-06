import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import ClockButtons from "../../components/DateTimePicker/ClockButtons";
import styles from "../../components/DateTimePicker/styles/ClockButtons.module.css";

jest.mock("@material-ui/icons/Restore", () => () => <span data-testid="start-icon"/>, {virtual: true});
jest.mock("@material-ui/icons/Schedule", () => () => <span data-testid="time-icon"/>, {virtual: true});
jest.mock("@material-ui/icons/Update", () => () => <span data-testid="end-icon"/>, {virtual: true});
jest.mock("react-i18next", () => ({useTranslation: () => ({t: key => key})}), {virtual: true});

const time = value => ({
    format: () => value,
    local: () => ({format: () => value}),
});

describe("ClockButtons", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    const show = props => act(() => { render(<ClockButtons {...props}/>, container); });

    it("renders nothing when hidden", () => {
        show({show: false, date: time("12:30")});
        expect(container.firstChild).toBeNull();
    });

    it("shows a single time button and opens its clock", () => {
        const onClick = jest.fn();
        show({show: true, date: time("12:30"), onClick});

        expect(container.querySelector(`.${styles.group}[role="group"]`)).not.toBeNull();
        const button = container.querySelector('[role="button"]');
        expect(button.classList.contains(styles.button)).toBe(true);
        expect(button.textContent).toBe("12:30");
        expect(button.querySelector('[data-testid="time-icon"]')).not.toBeNull();
        expect(button.getAttribute("title")).toBe("DateTimePicker.Set time");
        act(() => { button.click(); });
        act(() => { Simulate.keyDown(button, {key: "Enter"}); });
        expect(onClick).toHaveBeenNthCalledWith(1, "date");
        expect(onClick).toHaveBeenNthCalledWith(2, "date");
    });

    it("shows both range times and opens the selected clock", () => {
        const onClick = jest.fn();
        show({show: true, range: true, start: time("09:15"), end: time("11:45"), onClick});

        const buttons = container.querySelectorAll('[role="button"]');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].textContent).toBe("09:15");
        expect(buttons[1].textContent).toBe("11:45");
        expect(buttons[0].querySelector('[data-testid="start-icon"]')).not.toBeNull();
        expect(buttons[1].querySelector('[data-testid="end-icon"]')).not.toBeNull();
        act(() => { buttons[0].click(); buttons[1].click(); });
        expect(onClick.mock.calls).toEqual([["start"], ["end"]]);
    });

    it("keeps the missing end placeholder without an action", () => {
        const onClick = jest.fn();
        show({show: true, range: true, start: time("09:15"), onClick});

        const buttons = container.querySelectorAll('[role="button"]');
        expect(buttons[1].textContent).toBe("--:--");
        expect(buttons[1].getAttribute("tabindex")).toBe("-1");
        act(() => { buttons[1].click(); });
        expect(onClick).not.toHaveBeenCalled();
    });
});
