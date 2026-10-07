import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import SearchModal from "../../pages/search/SearchModal";

let mockHistory;

jest.mock("@mui/icons-material/ArrowBack", () => () => null, {virtual: true});
jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: (value, args) => args?.value ? value.replace("{{value}}", args.value) : value}),
}), {virtual: true});
jest.mock("react-router-dom", () => ({
    useHistory: () => mockHistory,
}), {virtual: true});

describe("SearchModal", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        mockHistory = {
            block: jest.fn(() => jest.fn()),
            location: {search: "?q=whisky"},
        };
    });

    afterEach(() => {
        act(() => {
            unmountComponentAtNode(container);
        });
        container.remove();
    });

    it("shows search content and wires both layouts' actions", () => {
        const onClose = jest.fn();
        const handleSearch = jest.fn();
        act(() => {
            render(<SearchModal onClose={onClose} handleSearch={handleSearch}/>, container);
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
