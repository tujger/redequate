import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import PostMenu from "../../components/PostComponent/PostMenu";

vi.mock("@mui/icons-material/MoreVert", () => ({ default: () => null }));
vi.mock("@mui/icons-material/ArrowDropDown", () => ({ default: () => null }));
vi.mock("@mui/icons-material/ArrowDropUp", () => ({ default: () => null }));
vi.mock("../../controllers/UserData", () => ({
  Role: { ADMIN: "admin" },
  matchRole: () => false,
  useCurrentUserData: () => ({ id: "user", disabled: false })
}));
vi.mock("../../controllers/General", () => ({
  useMetaInfo: () => ({ settings: { postsAllowEdit: true } })
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value) => value })
}));
vi.mock("../../components/PostComponent/ActionShare", () => ({ default: () => null }));
vi.mock("../../components/PostComponent/ActionEdit", () => ({ default: (props) => {
    const React = require("react");
    return React.createElement("div", { "data-action": "edit", "data-request": props.openRequest });
  } }));
vi.mock("../../components/PostComponent/ActionDelete", () => ({ default: (props) => {
    const React = require("react");
    return React.createElement("div", { "data-action": "delete", "data-open": String(props.open) });
  } }));

describe("PostMenu", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      render(<PostMenu postData={{ id: "post", uid: "user" }} />, container);
    });
  });

  afterEach(() => {
    unmount(container);
    container.remove();
  });

  it("keeps the edit action outside the menu after selection", () => {
    act(() => {
      container.querySelector('[role="button"]').click();
    });
    act(() => {
      document.querySelector('[data-value="edit"]').click();
    });

    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(container.querySelector('[data-action="edit"]').getAttribute("data-request")).toBe("1");
  });

  it("keeps delete confirmation outside the menu after selection", () => {
    act(() => {
      container.querySelector('[role="button"]').click();
    });
    act(() => {
      document.querySelector('[data-value="delete"]').click();
    });

    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(container.querySelector('[data-action="delete"]').getAttribute("data-open")).toBe("true");
  });
});
