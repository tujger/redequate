import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import Chip from "../../controls/Chip/Chip";

jest.mock("@material-ui/icons/Cancel", () => {
    const React = require("react");
    return props => React.createElement("svg", props);
}, {virtual: true});

describe("Chip", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        unmountComponentAtNode(container);
        container.remove();
    });

    it("renders an avatar and label and calls onDelete without bubbling", () => {
        const onDelete = jest.fn();
        const onParentClick = jest.fn();
        act(() => {
            render(<div onClick={onParentClick}>
                <Chip
                    avatar={<span>U</span>}
                    label={"User"}
                    onDelete={onDelete}
                />
            </div>, container);
        });

        expect(container.textContent).toContain("U");
        expect(container.textContent).toContain("User");
        act(() => container.querySelector('[role="button"]').click());

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onParentClick).not.toHaveBeenCalled();
    });

    it("renders a secondary label without a delete action", () => {
        act(() => {
            render(<Chip color={"secondary"} label={"Needs select type"}/>, container);
        });

        expect(container.textContent).toBe("Needs select type");
        expect(container.querySelector('[role="button"]')).toBeNull();
    });
});
