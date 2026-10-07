import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import RichSnackbarContent from "../../components/RichSnackbarContent";
import styles from "../../components/styles/RichSnackbarContent.module.css";

jest.mock("@mui/icons-material/Close", () => () => null, {virtual: true});
jest.mock("@mui/icons-material/ExpandMore", () => () => null, {virtual: true});
jest.mock("@mui/icons-material/ExpandLess", () => () => null, {virtual: true});

describe("RichSnackbarContent", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
    });

    const show = props => {
        act(() => {
            render(<RichSnackbarContent message={"Message"} closeHandler={jest.fn()} {...props}/>, container);
        });
        return container.firstChild;
    };

    it("forwards its ref and keeps message clicks separate from action clicks", () => {
        const ref = React.createRef();
        const onClick = jest.fn();
        const onButtonClick = jest.fn();
        const closeHandler = jest.fn();
        const root = show({ref, onClick, onButtonClick, closeHandler, buttonLabel: "Retry", variant: "warning"});
        expect(ref.current).toBe(root);
        expect(root.querySelector(`.${styles.warning}`)).not.toBeNull();

        act(() => { root.querySelector(`.${styles.message}`).click(); });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(closeHandler).not.toHaveBeenCalled();

        act(() => { Array.from(root.querySelectorAll('[role="button"]')).find(node => node.textContent === "Retry").click(); });
        expect(onButtonClick).toHaveBeenCalledTimes(1);
        expect(closeHandler).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);

        act(() => { root.querySelector('[title="Close"]').click(); });
        expect(closeHandler).toHaveBeenCalledTimes(2);
    });

    it("expands details, supports card clicks, and collapses again", () => {
        const onClick = jest.fn();
        const closeHandler = jest.fn();
        const root = show({body: "Details", image: "/image.png", buttonLabel: "Open", onClick, closeHandler, closeAfterClick: false});
        expect(root.querySelector(`.${styles.card}`)).toBeNull();

        act(() => { root.querySelector('[title="Expand"]').click(); });
        expect(root.querySelector(`.${styles.body}`).textContent).toBe("Details");
        expect(root.querySelector('[role="img"]')).not.toBeNull();
        expect(root.querySelectorAll('[role="button"]')).toHaveLength(4);

        act(() => { Simulate.keyDown(root.querySelector(`.${styles.cardAction}`), {key: "Enter"}); });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(closeHandler).not.toHaveBeenCalled();

        act(() => { root.querySelector('[title="Collapse"]').click(); });
        expect(root.querySelector(`.${styles.card}`)).toBeNull();
    });

    it("closes on a card click by default and lets a label alone close the snackbar", () => {
        const closeHandler = jest.fn();
        const root = show({body: "Details", buttonLabel: "Dismiss", closeHandler});
        act(() => { root.querySelector('[title="Expand"]').click(); });
        act(() => { root.querySelector(`.${styles.cardAction}`).click(); });
        expect(closeHandler).toHaveBeenCalledTimes(1);

        act(() => { root.querySelector(`.${styles.cardActions} [role="button"]`).click(); });
        expect(closeHandler).toHaveBeenCalledTimes(2);
    });
});
