import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import Picker from "../../components/DateTimePicker/Picker";
import TimeWrapper from "../../components/DateTimePicker/TimeWrapper";

vi.mock("moment", () => ({ default: vi.fn((value) => value) }));
vi.mock("../../components/DateTimePicker/DateWrapper", () => ({ default: ({ onClockClick, range }) => <div>
    <button onClick={() => onClockClick(range ? "start" : "date")} type="button">Open clock</button>
</div> }));
vi.mock("../../components/DateTimePicker/TimeWrapper", () => ({ default: vi.fn(() => <div>Clock</div>) }));

const makeTime = (hour, minute) => ({
  hour,
  minute,
  hours(value) {
    if (value === undefined) return this.hour;
    this.hour = value;
    return this;
  },
  minutes(value) {
    if (value === undefined) return this.minute;
    this.minute = value;
    return this;
  },
  isSameOrAfter: () => true
});

describe("Picker clock integration", () => {
  let container;

  beforeEach(() => {
    TimeWrapper.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
  });

  it("opens a single-date clock and applies the selected time", () => {
    const date = makeTime(12, 0);
    const onChange = vi.fn();
    act(() => {render(<Picker date={date} onChange={onChange} />, container);});
    act(() => {container.querySelector("button").click();});

    const props = TimeWrapper.mock.calls[0][0];
    expect(props.time).toBe(date);
    expect(props.classes).toBeUndefined();
    expect(props.style).toBeUndefined();
    act(() => {props.onSelect({ hour: 15, minute: 30 });});
    expect(onChange).toHaveBeenCalledWith(date);
    expect(date.hours()).toBe(15);
    expect(date.minutes()).toBe(30);
  });

  it("opens a range clock and applies the selected start time", () => {
    const start = makeTime(8, 0);
    const end = makeTime(17, 0);
    const onChange = vi.fn();
    act(() => {render(<Picker end={end} onChange={onChange} range start={start} />, container);});
    act(() => {container.querySelector("button").click();});

    const props = TimeWrapper.mock.calls[0][0];
    expect(props.time).toBe(start);
    act(() => {props.onSelect({ hour: 9, minute: 15 });});
    expect(onChange).toHaveBeenCalledWith(start, end);
    expect(start.hours()).toBe(9);
    expect(start.minutes()).toBe(15);
  });
});
