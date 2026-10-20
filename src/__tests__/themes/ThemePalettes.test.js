import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import ThemeAbstract from "../../themes/ThemeAbstract";
import ThemeSeason from "../../themes/ThemeSeason";
import ThemeDayNight from "../../themes/ThemeDayNight";

vi.mock("../../themes/ThemeSeason/Winter.css", () => ({ default: ":root { --test-season: winter; }" }));
vi.mock("../../themes/ThemeSeason/Spring.css", () => ({ default: ":root { --test-season: spring; }" }));
vi.mock("../../themes/ThemeSeason/Summer.css", () => ({ default: ":root { --test-season: summer; }" }));
vi.mock("../../themes/ThemeSeason/Fall.css", () => ({ default: ":root { --test-season: fall; }" }));
vi.mock("../../themes/ThemeDayNight/Day.css", () => ({ default: ":root { --test-time: day; }" }));
vi.mock("../../themes/ThemeDayNight/Night.css", () => ({ default: ":root { --test-time: night; }" }));

describe("CSS themes", () => {
  let container;
  let currentTime;
  let headChildren;
  const NativeDate = Date;
  const at = (month, day, hour = 0, minute = 0) => new NativeDate(2026, month, day, hour, minute).getTime();
  const show = (theme) => act(() => {
    render(theme, container);
  });
  const advanceTo = (time) => act(() => {
    currentTime = time;
    vi.runOnlyPendingTimers();
  });
  const mountedTheme = () => [...document.head.children].find((element) => !headChildren.has(element));

  beforeEach(() => {
    vi.useFakeTimers();
    currentTime = at(1, 28, 23);
    global.Date = class extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [currentTime]));
      }
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    headChildren = new Set(document.head.children);
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
    global.Date = NativeDate;
    vi.useRealTimers();
  });

  it("replaces the seasonal stylesheet at the month boundary", () => {
    show(<ThemeSeason />);
    const winterStyle = mountedTheme();
    expect(winterStyle.tagName).toBe("STYLE");
    expect(winterStyle.textContent).toContain("winter");

    advanceTo(at(1, 28, 23, 30));
    expect(mountedTheme()).toBe(winterStyle);

    advanceTo(at(2, 1));
    expect(winterStyle.isConnected).toBe(false);
    expect(mountedTheme().textContent).toContain("spring");

    show(null);
    expect(mountedTheme()).toBeUndefined();
  });

  it("switches day and night styles at the configured hours", () => {
    currentTime = at(0, 10, 7);
    show(<ThemeDayNight />);
    const nightStyle = mountedTheme();
    expect(nightStyle.textContent).toContain("night");

    advanceTo(at(0, 10, 7, 59));
    expect(mountedTheme()).toBe(nightStyle);

    advanceTo(at(0, 10, 8));
    expect(nightStyle.isConnected).toBe(false);
    const dayStyle = mountedTheme();
    expect(dayStyle.textContent).toContain("day");

    advanceTo(at(0, 10, 16, 59));
    expect(mountedTheme()).toBe(dayStyle);

    advanceTo(at(0, 10, 17));
    expect(dayStyle.isConnected).toBe(false);
    expect(mountedTheme().textContent).toContain("night");

    show(null);
    expect(mountedTheme()).toBeUndefined();
  });

  it("uses the new season's daylight hours after midnight", () => {
    show(<ThemeDayNight />);
    const nightStyle = mountedTheme();

    advanceTo(at(2, 1));
    expect(mountedTheme()).toBe(nightStyle);

    advanceTo(at(2, 1, 6));
    expect(nightStyle.isConnected).toBe(false);
    expect(mountedTheme().textContent).toContain("day");
  });

  it("mounts, replaces, and removes inline CSS", () => {
    show(<ThemeAbstract css={":root { --test-color: red; }"} />);
    const firstStyle = mountedTheme();
    expect(firstStyle.textContent).toContain("red");

    show(<ThemeAbstract css={":root { --test-color: blue; }"} />);
    expect(firstStyle.isConnected).toBe(false);
    expect(mountedTheme().textContent).toContain("blue");

    show(null);
    expect(mountedTheme()).toBeUndefined();
  });

  it("mounts and removes URL stylesheets without remounting an unchanged URL", () => {
    show(<ThemeAbstract href="/first.css" />);
    const firstLink = mountedTheme();
    expect(firstLink.tagName).toBe("LINK");
    expect(firstLink.rel).toBe("stylesheet");
    expect(firstLink.getAttribute("href")).toBe("/first.css");

    show(<ThemeAbstract href="/first.css" />);
    expect(mountedTheme()).toBe(firstLink);

    show(<ThemeAbstract href="/second.css" />);
    expect(firstLink.isConnected).toBe(false);
    expect(mountedTheme().getAttribute("href")).toBe("/second.css");

    show(null);
    expect(mountedTheme()).toBeUndefined();
  });
});
