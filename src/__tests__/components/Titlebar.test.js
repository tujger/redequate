import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import { fireEvent } from "@testing-library/dom";
import AvatarView from "../../components/AvatarView";
import Titlebar from "../../layouts/BottomToolbarLayout/Titlebar";
import styles from "../../layouts/BottomToolbarLayout/styles/Titlebar.module.css";
import baseStyles from "../../themes/Base.module.css";

let mockPathname;
let mockUser;
const mockGoBack = vi.hoisted(() => vi.fn());
const mockPages = {
  home: { label: "Home", route: "/home" },
  login: { label: "Sign in", route: "/login" },
  notfound: { label: "Not found", route: "/404" },
  private: { roles: ["login"], route: "/private", title: "Private" },
  profile: { label: "Profile", route: "/profile" },
  restricted: { roles: ["blocked"], route: "/restricted", title: "Restricted" }
};

vi.mock("@mui/icons-material/ChevronLeft", () => ({ default: () => <span data-testid="back-icon" /> }));
vi.mock("react-router-dom", () => {
  const React = require("react");
  return {
    Link: ({ children, to, ...props }) => React.createElement("a", { ...props, href: to, onClick: event => { event.preventDefault(); props.onClick?.(event); } }, children),
    useHistory: () => ({ goBack: mockGoBack }),
    useLocation: () => ({ pathname: mockPathname })
  };
});
vi.mock("../../controllers/General", () => ({ usePages: () => mockPages }));
vi.mock("../../controllers/UserData", () => ({
  currentRole: (user) => user.role,
  matchRole: (roles) => !roles?.includes("blocked"),
  needAuth: (roles) => Boolean(roles?.includes("login")),
  Role: { ADMIN: "admin" },
  useCurrentUserData: () => mockUser
}));
vi.mock("../../components/AvatarView", () => ({ default: vi.fn(() => <span data-testid="avatar" />) }));
vi.mock("../../components/ProgressView", () => ({ default: () => <div data-testid="progress" /> }));

describe("Titlebar", () => {
  let container;

  beforeEach(() => {
    mockPathname = "/home";
    mockUser = { id: "user", role: "user", initials: "UU", verified: true };
    mockGoBack.mockClear();
    AvatarView.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {unmount(container);});
    container.remove();
  });

  const show = (props) => act(() => {render(<Titlebar {...props} />, container);});

  it("shows the home title, profile link and progress without a back button", () => {
    show({ className: "extra" });
    const header = container.querySelector("header");
    expect(header.classList.contains(styles.appbar)).toBe(true);
    expect(header.classList.contains("extra")).toBe(true);
    expect(header.querySelector(`.${styles.toolbar}`)).not.toBeNull();
    expect(header.querySelector("h6").textContent).toBe("Home");
    expect(header.querySelector('[role="button"]')).toBeNull();
    expect(header.querySelector('[data-testid="progress"]')).not.toBeNull();

    const profile = header.querySelector('a[href="/profile"]');
    expect(profile).not.toBeNull();
    expect(AvatarView.mock.calls[0][0]).toMatchObject({ admin: false, initials: "UU", verified: true });
    act(() => {fireEvent.pointerDown(profile, { clientX: 10, clientY: 12 });});
    expect(profile.classList.contains(baseStyles.ripple)).toBe(true);
  });

  it("goes back by click or keyboard while keeping the ChevronLeft icon", () => {
    mockPathname = "/profile";
    show({});
    const button = container.querySelector('[role="button"]');
    expect(button.getAttribute("aria-label")).toBe("Go back");
    expect(button.querySelector('[data-testid="back-icon"]')).not.toBeNull();
    act(() => {button.click();});
    act(() => {fireEvent.keyDown(button, { key: "Enter" });});
    expect(mockGoBack).toHaveBeenCalledTimes(2);
    expect(container.querySelector("h6").textContent).toBe("Profile");
  });

  it("shows the login or not-found title for inaccessible routes and omits an anonymous avatar", () => {
    mockUser = { id: null, role: "guest" };
    mockPathname = "/private";
    show({});
    expect(container.querySelector("h6").textContent).toBe("Sign in");
    expect(container.querySelector('a[href="/profile"]')).toBeNull();

    mockPathname = "/restricted";
    show({});
    expect(container.querySelector("h6").textContent).toBe("Not found");
  });
});
