import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import Select from "../../controls/Select/Select";

jest.mock("@material-ui/icons/ArrowDropDown", () => {
    const React = require("react");
    return props => React.createElement("svg", props);
}, {virtual: true});
jest.mock("@material-ui/icons/ArrowDropUp", () => {
    const React = require("react");
    return props => React.createElement("svg", props);
}, {virtual: true});

describe("Select", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        unmountComponentAtNode(container);
        container.remove();
    });

    it("selects an option and reports its value", () => {
        const onChange = jest.fn();
        act(() => {
            render(<Select
                onChange={onChange}
                options={[{label: "All", value: "all"}, {label: "Recent", value: "recent"}]}
                value={"all"}
            />, container);
        });

        expect(container.querySelector('[data-testid="select-arrow-down"]')).not.toBeNull();
        act(() => container.firstChild.click());
        expect(container.querySelector('[data-testid="select-arrow-up"]')).not.toBeNull();
        const menu = document.querySelector('[role="listbox"]');
        expect(menu).not.toBeNull();
        act(() => {
            menu.querySelectorAll('[role="option"]')[1].click();
        });

        expect(onChange.mock.calls[0][0].target.value).toBe("recent");
        expect(document.querySelector('[role="listbox"]')).toBeNull();
    });

    it("does not render a dropdown arrow for icon menus", () => {
        act(() => {
            render(<Select
                iconMenu
                options={[{label: "Edit", value: "edit"}]}
                value={""}
            />, container);
        });

        expect(container.querySelector('[data-testid^="select-arrow-"]')).toBeNull();
    });

    it("opens and selects with the keyboard", () => {
        const onChange = jest.fn();
        act(() => {
            render(<Select
                onChange={onChange}
                options={[{label: "All", value: "all"}, {label: "Recent", value: "recent"}]}
                value={"all"}
            />, container);
        });

        const trigger = container.firstChild;
        act(() => {
            Simulate.keyDown(trigger, {key: "ArrowDown"});
        });
        const menu = document.querySelector('[role="listbox"]');
        expect(menu).not.toBeNull();
        act(() => {
            Simulate.keyDown(menu, {key: "ArrowDown"});
        });
        act(() => {
            Simulate.keyDown(menu, {key: "Enter"});
        });

        expect(onChange.mock.calls[0][0].target.value).toBe("recent");
    });

    it("uses an external anchor and obeys controlled open", () => {
        const anchor = document.createElement("button");
        document.body.appendChild(anchor);
        const onClose = jest.fn();
        const props = {anchorEl: anchor, onClose, options: [{label: "Save", value: "save"}], value: ""};

        act(() => {
            render(<Select {...props} open/>, container);
        });
        expect(document.querySelector('[role="listbox"]')).not.toBeNull();
        const backdrop = document.querySelector('[data-testid="select-backdrop"]');
        expect(backdrop).not.toBeNull();
        act(() => backdrop.click());
        expect(onClose).toHaveBeenCalledTimes(1);

        act(() => {
            render(<Select {...props} open={false}/>, container);
        });
        expect(document.querySelector('[role="listbox"]')).toBeNull();
        anchor.remove();
    });
});
