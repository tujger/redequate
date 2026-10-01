import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import MainContent from "../../components/MainContent";
import BottomToolbarLayout from "../../layouts/BottomToolbarLayout/BottomToolbarLayout";
import styles from "../../layouts/BottomToolbarLayout/styles/BottomToolbarLayout.module.css";

jest.mock("@material-ui/core/CssBaseline", () => () => null, {virtual: true});
jest.mock("@material-ui/core/Typography", () => props => {
    const React = require("react");
    return React.createElement("p", props);
}, {virtual: true});
jest.mock("../../components/MainContent", () => jest.fn(() => null));
jest.mock("../../layouts/BottomToolbarLayout/BottomToolbar", () => jest.fn(() => null));
jest.mock("../../layouts/BottomToolbarLayout/Titlebar", () => () => null);
jest.mock("../../components/Snackbar", () => () => null);
jest.mock("../../controllers/Notifications", () => ({NotificationsSnackbar: () => null}));
jest.mock("../../components/DispatchedConfirmComponent", () => () => null);

describe("BottomToolbarLayout", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        MainContent.mockClear();
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    it("keeps the toolbar marker and passes layout classes to page content", () => {
        act(() => {
            render(<BottomToolbarLayout footerComponent={<span>Footer</span>} menu={[]}/>, container);
        });

        const root = container.firstChild;
        expect(root.classList.contains(styles.container)).toBe(true);
        expect(root.hasAttribute("data-bottom-toolbar")).toBe(true);
        expect(root.querySelector(`.${styles.indent}`)).not.toBeNull();
        expect(root.textContent).toContain("Footer");
        const classes = MainContent.mock.calls[0][0].classes;
        expect(Object.values(classes).every(Boolean)).toBe(true);
        expect(classes).toEqual({
            bottom: styles.bottom,
            bottomSticky: styles.bottomSticky,
            center: styles.center,
            left: styles.left,
            right: styles.right,
            top: styles.top,
            topSticky: styles.topSticky,
        });
    });
});
