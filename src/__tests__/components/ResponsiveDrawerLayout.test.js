import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import MainAppbar from "../../layouts/ResponsiveDrawerLayout/MainAppbar";
import MainContent from "../../components/MainContent";
import ResponsiveDrawerLayout from "../../layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout";
import styles from "../../layouts/ResponsiveDrawerLayout/styles/ResponsiveDrawerLayout.module.css";
import baseStyles from "../../themes/Base.module.css";

const mockEnableDisabledPages = vi.hoisted(() => vi.fn());
const mockRefreshAll = vi.hoisted(() => vi.fn());
const mockNotifySnackbar = vi.hoisted(() => vi.fn());
const mockUser = { id: "admin", role: "admin" };

vi.mock("@mui/icons-material/ChevronLeft", () => ({ default: () => <span data-testid="close-icon" /> }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (value) => value }) }));
vi.mock("../../layouts/ResponsiveDrawerLayout/MainAppbar", () => ({ default: vi.fn(({ onHamburgerClick, className }) =>
  <button className={className} data-testid="hamburger" onClick={onHamburgerClick}>Open</button>) }));
vi.mock("../../layouts/ResponsiveDrawerLayout/MainMenu", () => ({ default: ({ onClick }) =>
  <button data-testid="menu-action" onClick={onClick}>Item</button> }));
vi.mock("../../components/MainContent", () => ({ default: vi.fn(() => null) }));
vi.mock("../../components/Snackbar", () => ({ default: () => null }));
vi.mock("../../controllers/Notifications", () => ({ NotificationsSnackbar: () => null }));
vi.mock("../../components/DispatchedConfirmComponent", () => ({ default: () => null }));
vi.mock("../../controllers/General", () => ({
  enableDisabledPages: () => mockEnableDisabledPages(),
  useStore: () => ({ id: "store" })
}));
vi.mock("../../controllers/UserData", () => ({
  matchRole: () => true,
  Role: { ADMIN: "admin" },
  useCurrentUserData: () => mockUser
}));
vi.mock("../../controllers/Store", () => ({ refreshAll: (...args) => mockRefreshAll(...args) }));
vi.mock("../../controllers/WrapperControl", () => ({
  hasWrapperControlInterface: () => false,
  wrapperControlCall: vi.fn()
}));
vi.mock("../../controllers/notifySnackbar", () => ({ default: (...args) => mockNotifySnackbar(...args) }));

const MockHeader = ({ title }) => <div data-testid="drawer-header">{title}</div>;

const pointer = (target, type, x, y = 20) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "touch" },
    clientX: { value: x },
    clientY: { value: y }
  });
  target.dispatchEvent(event);
};

describe("ResponsiveDrawerLayout", () => {
  let container;
  let portalTarget;
  let originalWidth;
  let originalOverflow;

  beforeEach(() => {
    vi.useFakeTimers();
    originalWidth = window.innerWidth;
    originalOverflow = document.body.style.overflow;
    container = document.createElement("div");
    portalTarget = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(portalTarget);
    MainAppbar.mockClear();
    MainContent.mockClear();
    mockEnableDisabledPages.mockReset();
    mockRefreshAll.mockClear();
    mockNotifySnackbar.mockClear();
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
    portalTarget.remove();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    document.body.style.overflow = originalOverflow;
    vi.useRealTimers();
  });

  const show = (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    act(() => {
      render(<ResponsiveDrawerLayout
        container={portalTarget}
        copyright="Copyright"
        footerComponent={<span>Footer</span>}
        headerComponent={<MockHeader />}
        menu={[]}
        title="Example" />,
      container);
      window.dispatchEvent(new Event("resize"));
    });
  };

  it("keeps a permanent drawer and page offsets on wide screens", () => {
    show(960);
    const drawer = container.querySelector(`nav.${styles.drawer}`);
    expect(drawer).not.toBeNull();
    expect(drawer.textContent).toContain("Example");
    expect(portalTarget.querySelector("nav")).toBeNull();
    expect(MainAppbar.mock.calls[0][0].onHamburgerClick).toBeUndefined();
    expect(container.querySelector(`.${styles.indent}`)).not.toBeNull();
    expect(container.textContent).toContain("Footer");
    expect(MainContent).toHaveBeenCalled();
    expect(MainContent.mock.calls[0][0].classes).toBeUndefined();

    mockEnableDisabledPages.mockReturnValue(2);
    const copyright = drawer.querySelector(`.${styles.copyrightRow}`);
    act(() => {copyright.click();copyright.click();copyright.click();});
    expect(mockEnableDisabledPages).toHaveBeenCalledTimes(1);
    expect(mockRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("opens a temporary drawer in the custom portal and closes with Escape or the backdrop", () => {
    show(959);
    const opener = container.querySelector('[data-testid="hamburger"]');
    expect(MainAppbar.mock.calls[0][0].onHamburgerClick).toEqual(expect.any(Function));
    expect(portalTarget.querySelector('nav[role="dialog"]')).not.toBeNull();
    opener.focus();
    act(() => {opener.click();});
    const portal = portalTarget.querySelector(`.${styles.portal}`);
    const drawer = portal.querySelector('nav[role="dialog"]');
    expect(portal.getAttribute("data-open")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(drawer);

    act(() => {document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));});
    expect(portal.getAttribute("data-open")).toBe("false");
    expect(document.body.style.overflow).toBe(originalOverflow);
    expect(document.activeElement).toBe(opener);

    act(() => {opener.click();});
    act(() => {portal.querySelector(`.${styles.backdrop}`).click();});
    expect(portal.getAttribute("data-open")).toBe("false");
  });

  it("closes through the menu or close button and keeps the ChevronLeft icon and ripple", () => {
    show(375);
    const opener = container.querySelector('[data-testid="hamburger"]');
    act(() => {opener.click();});
    const portal = portalTarget.querySelector(`.${styles.portal}`);
    const closeButton = portal.querySelector('[role="button"][aria-label="Close navigation"]');
    expect(closeButton.querySelector('[data-testid="close-icon"]')).not.toBeNull();
    act(() => {fireEvent.pointerDown(closeButton, { clientX: 12, clientY: 12 });});
    expect(closeButton.classList.contains(baseStyles.ripple)).toBe(true);
    act(() => {closeButton.click();});
    expect(portal.getAttribute("data-open")).toBe("false");

    act(() => {opener.click();});
    act(() => {portal.querySelector('[data-testid="menu-action"]').click();});
    expect(portal.getAttribute("data-open")).toBe("false");
  });

  it("follows touch swipes from the edge and across the open drawer", () => {
    show(375);
    const portal = portalTarget.querySelector(`.${styles.portal}`);
    act(() => {pointer(document.body, "pointerdown", 10);});
    act(() => {pointer(window, "pointermove", 130);});
    expect(portal.getAttribute("data-progress")).toBe("0.5");
    act(() => {pointer(window, "pointerup", 130);});
    expect(portal.getAttribute("data-open")).toBe("true");

    const drawer = portal.querySelector('nav[role="dialog"]');
    act(() => {pointer(drawer, "pointerdown", 200);});
    act(() => {pointer(window, "pointermove", 80);});
    expect(portal.getAttribute("data-progress")).toBe("0.5");
    act(() => {pointer(window, "pointerup", 80);});
    expect(portal.getAttribute("data-open")).toBe("false");
  });

  it("keeps keyboard focus inside the temporary drawer and restores layout on resize", () => {
    show(959);
    const opener = container.querySelector('[data-testid="hamburger"]');
    act(() => {opener.click();});
    const drawer = portalTarget.querySelector('nav[role="dialog"]');
    const last = drawer.querySelector('[data-testid="menu-action"]');

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(last);
    act(() => {document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));});
    expect(document.activeElement).toBe(drawer.querySelector('[role="button"][aria-label="Close navigation"]'));

    show(960);
    expect(portalTarget.querySelector("nav")).toBeNull();
    expect(container.querySelector(`nav.${styles.drawer}`)).not.toBeNull();
    expect(document.body.style.overflow).toBe(originalOverflow);
    expect(MainAppbar.mock.calls[MainAppbar.mock.calls.length - 1][0].onHamburgerClick).toBeUndefined();
  });

  it("ignores short or vertical swipes and closes on Back without leaving the page", () => {
    show(375);
    const opener = container.querySelector('[data-testid="hamburger"]');
    act(() => {opener.click();});
    const portal = portalTarget.querySelector(`.${styles.portal}`);
    const drawer = portal.querySelector('nav[role="dialog"]');
    act(() => {pointer(drawer, "pointerdown", 200);});
    act(() => {pointer(window, "pointermove", 175);});
    act(() => {pointer(window, "pointerup", 175);});
    expect(portal.getAttribute("data-open")).toBe("true");

    act(() => {pointer(drawer, "pointerdown", 200);});
    act(() => {pointer(window, "pointermove", 204, 100);});
    expect(portal.getAttribute("data-progress")).toBe("1");

    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    try {
      act(() => {window.dispatchEvent(new PopStateEvent("popstate"));});
      expect(portal.getAttribute("data-open")).toBe("false");
      expect(go).toHaveBeenCalledWith(1);
    } finally {
      go.mockRestore();
    }
  });
});
