import { vi } from "vitest";
import React from "react";
import { render, unmount } from "../render";
import { act } from "react";
import SearchModal from "../../pages/search/SearchModal";

let mockHistory;

vi.mock("@mui/icons-material/ArrowBack", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value, args) => args?.value ? value.replace("{{value}}", args.value) : value })
}));
vi.mock("react-router-dom", () => ({
  useHistory: () => mockHistory
}));

describe("SearchModal", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockHistory = {
      block: vi.fn(() => vi.fn()),
      location: { search: "?q=whisky" }
    };
  });

  afterEach(() => {
    act(() => {
      unmount(container);
    });
    container.remove();
  });

  it("shows search content and wires both layouts' actions", () => {
    const onClose = vi.fn();
    const handleSearch = vi.fn();
    act(() => {
      render(<SearchModal onClose={onClose} handleSearch={handleSearch} />, container);
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("whisky");
    const buttons = dialog.querySelectorAll('[role="button"]');
    act(() => {
      buttons[0].click();
      buttons[1].click();
      buttons[2].click();
      buttons[3].click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(handleSearch).toHaveBeenCalledTimes(2);
  });
});
