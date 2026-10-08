import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import TimeKeeper from "react-timekeeper";
import TimeWrapper from "../../components/DateTimePicker/TimeWrapper";
import styles from "../../components/DateTimePicker/styles/TimeWrapper.module.css";

vi.mock("react-timekeeper", () => ({ default: vi.fn(({ doneButton }) => <div className="react-timekeeper">
    {doneButton()}
</div>) }));

describe("TimeWrapper", () => {
  let container;

  beforeEach(() => {
    TimeKeeper.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
  });

  it("passes the selected time and callback to the styled clock", () => {
    const onSelect = vi.fn();
    const time = { hours: () => 14, minutes: () => 35 };
    act(() => {render(<TimeWrapper onSelect={onSelect} time={time} />, container);});

    const props = TimeKeeper.mock.calls[0][0];
    expect(container.firstChild.className).toBe(styles.clock);
    expect(container.firstChild.querySelector(".react-timekeeper")).not.toBeNull();
    expect(props.className).toBeUndefined();
    expect(props.time).toEqual({ hour: 14, minute: 35 });
    expect(props.closeOnMinuteSelect).toBe(true);
    expect(props.switchToMinuteOnHourSelect).toBe(true);
    expect(props.hour24Mode).toBe(false);
    expect(container.querySelector("style")).toBeNull();

    const doneButton = container.querySelector("button");
    expect(doneButton.hidden).toBe(true);
    expect(doneButton.type).toBe("button");

    props.onDoneClick({ hour: 15, minute: 10 });
    expect(onSelect).toHaveBeenCalledWith({ hour: 15, minute: 10 });
  });

  it("passes null when no time is selected", () => {
    act(() => {render(<TimeWrapper onSelect={vi.fn()} time={null} />, container);});
    expect(TimeKeeper.mock.calls[0][0].time).toBeNull();
  });
});
