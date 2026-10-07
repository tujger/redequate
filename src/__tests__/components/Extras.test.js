import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import Extras from "../../components/DateTimePicker/Extras";
import baseStyles from "../../themes/Base.module.css";

jest.mock("@mui/icons-material/MoreVert", () => () => <span data-testid="more-icon"/>, {virtual: true});
jest.mock("@mui/icons-material/ArrowDropDown", () => () => null, {virtual: true});
jest.mock("@mui/icons-material/ArrowDropUp", () => () => null, {virtual: true});
jest.mock("react-i18next", () => ({useTranslation: () => ({t: key => key})}), {virtual: true});
jest.mock("moment", () => jest.fn((seed, format) => ({
    seed,
    format,
    operations: [],
    add(value, unit) { this.operations.push(["add", value, unit]); return this; },
    subtract(value, unit) { this.operations.push(["subtract", value, unit]); return this; },
    weekday(value) { this.operations.push(["weekday", value]); return this; },
    date(value) { this.operations.push(["date", value]); return this; },
})), {virtual: true});

describe("Extras", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    const show = props => act(() => { render(<Extras {...props}/>, container); });
    const open = () => act(() => { container.querySelector('[role="button"]').click(); });
    const labels = () => Array.from(document.querySelectorAll('[role="menuitem"]')).map(item => item.textContent);

    it("renders nothing when hidden", () => {
        show({show: false});
        expect(container.firstChild).toBeNull();
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("shows three presets for one date and applies the selected period", () => {
        const onSelect = jest.fn();
        show({show: true, onSelect});
        const trigger = container.querySelector('[role="button"]');
        expect(trigger.querySelector('[data-testid="more-icon"]')).not.toBeNull();
        expect(trigger.getAttribute("aria-expanded")).toBe("false");

        open();
        const menu = document.querySelector('[role="menu"]');
        expect(menu.parentElement).toBe(document.body);
        expect(trigger.getAttribute("aria-expanded")).toBe("true");
        expect(labels()).toEqual([
            "DateTimePicker.Today", "DateTimePicker.Yesterday", "DateTimePicker.Tomorrow",
        ]);
        expect(menu.querySelector('[role="separator"]')).toBeNull();
        const today = menu.querySelector('#today');
        act(() => { Simulate.pointerDown(today, {clientX: 4, clientY: 4}); });
        expect(today.classList.contains(baseStyles.ripple)).toBe(true);
        act(() => { today.click(); });
        expect(onSelect).toHaveBeenCalledTimes(1);
        const [start, end] = onSelect.mock.calls[0];
        expect(start.seed).toBe("12:00");
        expect(start.operations).toEqual([]);
        expect(end.operations).toEqual([["add", 1, "day"], ["subtract", 1, "second"]]);
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });

    it("shows grouped range presets and preserves week and month calculations", () => {
        const onSelect = jest.fn();
        show({show: true, range: true, onSelect});
        open();
        expect(labels()).toEqual([
            "DateTimePicker.Today", "DateTimePicker.Tomorrow", "DateTimePicker.Yesterday",
            "DateTimePicker.This week", "DateTimePicker.Next week", "DateTimePicker.Last week",
            "DateTimePicker.This month", "DateTimePicker.Next month", "DateTimePicker.Last month",
        ]);
        expect(document.querySelectorAll('[role="separator"]')).toHaveLength(2);

        act(() => { document.querySelector('#week').click(); });
        let [start, end] = onSelect.mock.calls[0];
        expect(start.seed).toBe("00:00");
        expect(start.operations).toEqual([["weekday", 0]]);
        expect(end.operations).toEqual([["weekday", 0], ["add", 1, "week"], ["subtract", 1, "second"]]);

        open();
        act(() => { document.querySelector('#nextmonth').click(); });
        [start, end] = onSelect.mock.calls[1];
        expect(start.operations).toEqual([["date", 1], ["add", 1, "month"]]);
        expect(end.operations).toEqual([["date", 1], ["add", 2, "month"], ["subtract", 1, "second"]]);
    });

    it("opens with the keyboard and closes on Escape, backdrop click, or hiding", () => {
        show({show: true, onSelect: jest.fn()});
        const trigger = container.querySelector('[role="button"]');
        act(() => { Simulate.keyDown(trigger, {key: "Enter"}); });
        let menu = document.querySelector('[role="menu"]');
        expect(menu).not.toBeNull();
        expect(document.activeElement).toBe(menu.querySelector('[role="menuitem"]'));
        act(() => { Simulate.keyDown(menu, {key: "Escape"}); });
        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(document.activeElement).toBe(trigger);

        open();
        act(() => { document.querySelector('[data-testid="select-backdrop"]').click(); });
        expect(document.querySelector('[role="menu"]')).toBeNull();

        open();
        show({show: false});
        expect(document.querySelector('[role="menu"]')).toBeNull();
        show({show: true});
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });
});
