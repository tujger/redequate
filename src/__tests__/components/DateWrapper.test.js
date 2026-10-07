import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import DatePicker from "react-datepicker";
import DateWrapper from "../../components/DateTimePicker/DateWrapper";
import styles from "../../components/DateTimePicker/styles/DateWrapper.module.css";
import baseStyles from "../../themes/Base.module.css";

const mockChangeYear = jest.fn();
const mockDecreaseMonth = jest.fn();
const mockIncreaseMonth = jest.fn();
let mockPreviousDisabled = false;
let mockNextDisabled = false;

jest.mock("@material-ui/icons/ChevronLeft", () => () => <span data-testid="previous-icon"/>, {virtual: true});
jest.mock("@material-ui/icons/ChevronRight", () => () => <span data-testid="next-icon"/>, {virtual: true});
jest.mock("react-datepicker-t/dist/react-datepicker.css", () => ({}), {virtual: true});
jest.mock("moment", () => {
    const fixedToday = new Date(2026, 9, 2, 12);
    return value => {
        const raw = value?.raw || value || fixedToday;
        const date = new Date(raw);
        const same = (other, unit) => {
            const compared = new Date(other?.raw || other);
            return unit === "day" ? date.toDateString() === compared.toDateString() : date.getTime() === compared.getTime();
        };
        const compare = (other, unit) => {
            const compared = new Date(other?.raw || other);
            return unit === "day"
                ? [new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
                    new Date(compared.getFullYear(), compared.getMonth(), compared.getDate()).getTime()]
                : [date.getTime(), compared.getTime()];
        };
        return {
            raw: date,
            format: format => format === "YYYY" ? String(date.getFullYear()) : "October 2026",
            isSame: same,
            isSameOrAfter: (other, unit) => compare(other, unit)[0] >= compare(other, unit)[1],
            isSameOrBefore: (other, unit) => compare(other, unit)[0] <= compare(other, unit)[1],
            month: () => date.getMonth(),
            toDate: () => date,
        };
    };
}, {virtual: true});
jest.mock("react-datepicker-t", () => {
    const React = require("react");
    return jest.fn(props => <div className={props.calendarClassName}>
        {React.createElement(props.renderCustomHeader, {
            changeYear: mockChangeYear,
            date: new Date(2026, 9, 1),
            decreaseMonth: mockDecreaseMonth,
            increaseMonth: mockIncreaseMonth,
            prevMonthButtonDisabled: mockPreviousDisabled,
            nextMonthButtonDisabled: mockNextDisabled,
        })}
        {props.children}
    </div>);
}, {virtual: true});
jest.mock("../../components/DateTimePicker/DateButtons", () => () => <div data-testid="date-buttons"/>);
jest.mock("../../components/DateTimePicker/ClockButtons", () => ({show}) => show ? <div data-testid="clock-buttons"/> : null);
jest.mock("../../components/DateTimePicker/TodayButton", () => ({show, onClick}) => show
    ? <button data-testid="today" onClick={onClick}>Today</button> : null);
jest.mock("../../components/DateTimePicker/Extras", () => ({show}) => show ? <div data-testid="extras"/> : null);

describe("DateWrapper", () => {
    let container;

    beforeEach(() => {
        mockChangeYear.mockClear();
        mockDecreaseMonth.mockClear();
        mockIncreaseMonth.mockClear();
        mockPreviousDisabled = false;
        mockNextDisabled = false;
        DatePicker.mockClear();
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    const show = props => act(() => { render(<DateWrapper {...props}/>, container); });
    const pickerProps = () => DatePicker.mock.calls[DatePicker.mock.calls.length - 1][0];

    it("passes CSS Module classes for calendar, days, and months", () => {
        show({date: {raw: new Date(2026, 7, 5), month: () => 7, toDate: () => new Date(2026, 7, 5)}});
        const picker = pickerProps();
        expect(picker.calendarClassName).toBe(styles.calendar);
        expect(picker.headerClassName).toBe(styles.header);
        expect(picker.daynameClassName).toBe(styles.regular);
        expect(picker.dayClassName(new Date(2026, 7, 5))).toBe(styles.selected);
        expect(picker.dayClassName(new Date(2026, 9, 2))).toBe(styles.current);
        expect(picker.dayClassName(new Date(2026, 9, 3))).toBe(styles.regular);
        expect(picker.monthClassName(7)).toBe(styles.selected);
        expect(picker.monthClassName(9)).toBe(styles.current);

        show({range: true, start: {raw: new Date(2026, 7, 5), month: () => 7, toDate: () => new Date(2026, 7, 5)},
            end: {raw: new Date(2026, 9, 8), month: () => 9, toDate: () => new Date(2026, 9, 8)}});
        const rangePicker = pickerProps();
        expect(rangePicker.dayClassName(new Date(2026, 7, 5))).toBe(styles.selected);
        expect(rangePicker.dayClassName(new Date(2026, 8, 5))).toBe(styles.range);
        expect(rangePicker.monthClassName(8)).toBe(styles.range);
    });

    it("navigates months and years with the same header buttons", () => {
        show({});
        const buttons = () => container.querySelectorAll(`.${styles.headerControls} [role="button"]`);
        expect(buttons()).toHaveLength(3);
        expect(buttons()[0].querySelector('[data-testid="previous-icon"]')).not.toBeNull();
        expect(buttons()[2].querySelector('[data-testid="next-icon"]')).not.toBeNull();
        act(() => { buttons()[0].click(); buttons()[2].click(); });
        expect(mockDecreaseMonth).toHaveBeenCalledTimes(1);
        expect(mockIncreaseMonth).toHaveBeenCalledTimes(1);

        act(() => { buttons()[1].click(); });
        expect(pickerProps().showMonthYearPicker).toBe(true);
        expect(buttons()[1].textContent).toBe("2026");
        act(() => { buttons()[0].click(); buttons()[2].click(); });
        expect(mockChangeYear.mock.calls).toEqual([[2025], [2027]]);

        act(() => { Simulate.pointerDown(buttons()[1], {clientX: 5, clientY: 5}); });
        expect(buttons()[1].classList.contains(baseStyles.ripple)).toBe(true);
    });

    it("respects disabled navigation and returns from month selection", () => {
        mockPreviousDisabled = true;
        show({});
        const buttons = container.querySelectorAll(`.${styles.headerControls} [role="button"]`);
        expect(buttons[0].getAttribute("aria-disabled")).toBe("true");
        act(() => { buttons[0].click(); });
        expect(mockDecreaseMonth).not.toHaveBeenCalled();

        act(() => { buttons[1].click(); });
        expect(pickerProps().showMonthYearPicker).toBe(true);
        act(() => { pickerProps().onSelect(new Date(2026, 8, 1)); });
        expect(pickerProps().showMonthYearPicker).toBe(false);
        expect(pickerProps().openToDate).toEqual(new Date(2026, 8, 1));
    });

    it("keeps ordinary and range actions in their respective layouts", () => {
        const onSelect = jest.fn();
        show({date: {raw: new Date(2026, 9, 2), toDate: () => new Date(2026, 9, 2)}, onSelect});
        expect(container.querySelector(`.${styles.actions}`)).not.toBeNull();
        expect(container.querySelector('[data-testid="clock-buttons"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="today"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="extras"]')).not.toBeNull();
        act(() => { container.querySelector('[data-testid="today"]').click(); });
        expect(onSelect).toHaveBeenCalledTimes(1);

        show({range: true, onSelect});
        expect(container.querySelector(`.${styles.rangeActions}`)).not.toBeNull();
        expect(container.querySelector('[data-testid="clock-buttons"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="today"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="extras"]')).not.toBeNull();
    });
});
