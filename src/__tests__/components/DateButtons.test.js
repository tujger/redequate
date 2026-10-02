import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import DateButtons from "../../components/DateTimePicker/DateButtons";
import styles from "../../components/DateTimePicker/styles/DateButtons.module.css";
import baseStyles from "../../themes/Base.module.css";

jest.mock("react-i18next", () => ({useTranslation: () => ({t: key => key})}), {virtual: true});

const date = value => ({
    format: () => value,
    local: () => ({format: () => value}),
});

describe("DateButtons", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    const show = props => act(() => { render(<DateButtons {...props}/>, container); });

    it("renders nothing without a date or range endpoint", () => {
        show({});
        expect(container.firstChild).toBeNull();
    });

    it("shows a single date as a passive label", () => {
        const onClick = jest.fn();
        show({date: date("10/02/2026 2:30 PM"), onClick});

        expect(container.querySelector(`.${styles.group}[role="group"]`)).not.toBeNull();
        expect(container.querySelector(`.${styles.sublabel}`).textContent).toBe("10/02/2026 2:30 PM");
        expect(container.querySelector('[role="button"]')).toBeNull();
        expect(onClick).not.toHaveBeenCalled();
    });

    it("shows both range dates and selects each by click or keyboard", () => {
        const onClick = jest.fn();
        show({start: date("10/01/2026 9:00 AM"), end: date("10/02/2026 2:30 PM"), onClick});

        const buttons = container.querySelectorAll('[role="button"]');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].textContent).toBe("10/01/2026 9:00 AM");
        expect(buttons[1].textContent).toBe("10/02/2026 2:30 PM");
        expect(buttons[0].getAttribute("title")).toBe("DateTimePicker.Select start date");
        expect(buttons[1].getAttribute("title")).toBe("DateTimePicker.Select end date");

        act(() => { buttons[0].click(); });
        act(() => { Simulate.keyDown(buttons[1], {key: "Enter"}); });
        expect(onClick.mock.calls).toEqual([["start"], ["end"]]);
        act(() => { Simulate.pointerDown(buttons[0], {clientX: 5, clientY: 5}); });
        expect(buttons[0].classList.contains(baseStyles.ripple)).toBe(true);
    });

    it("keeps missing range endpoints selectable", () => {
        const onClick = jest.fn();
        show({start: date("10/01/2026 9:00 AM"), onClick});
        let buttons = container.querySelectorAll('[role="button"]');
        expect(buttons[1].textContent).toBe("-");
        act(() => { buttons[1].click(); });
        expect(onClick).toHaveBeenCalledWith("end");

        show({end: date("10/02/2026 2:30 PM"), onClick});
        buttons = container.querySelectorAll('[role="button"]');
        expect(buttons[0].textContent).toBe("-");
        act(() => { buttons[0].click(); });
        expect(onClick).toHaveBeenCalledWith("start");
    });
});
