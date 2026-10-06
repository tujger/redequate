import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import useBreakpoint, {getBreakpoint} from "../../helpers/useBreakpoint";

const Breakpoint = ({width}) => <span>{useBreakpoint(width)}</span>;

describe("useBreakpoint", () => {
    let container;
    let originalWidth;

    beforeEach(() => {
        originalWidth = window.innerWidth;
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
        Object.defineProperty(window, "innerWidth", {configurable: true, value: originalWidth});
    });

    it("uses the same breakpoint boundaries as Material UI", () => {
        expect([0, 599, 600, 959, 960, 1279, 1280, 1919, 1920].map(getBreakpoint))
            .toEqual(["xs", "xs", "sm", "sm", "md", "md", "lg", "lg", "xl"]);
    });

    it("updates on resize and honors an explicit width", () => {
        Object.defineProperty(window, "innerWidth", {configurable: true, value: 599});
        act(() => { render(<Breakpoint/>, container); });
        expect(container.textContent).toBe("xs");

        Object.defineProperty(window, "innerWidth", {configurable: true, value: 960});
        act(() => { window.dispatchEvent(new Event("resize")); });
        expect(container.textContent).toBe("md");

        act(() => { render(<Breakpoint width="sm"/>, container); });
        expect(container.textContent).toBe("sm");
        Object.defineProperty(window, "innerWidth", {configurable: true, value: 1920});
        act(() => { window.dispatchEvent(new Event("resize")); });
        expect(container.textContent).toBe("sm");
        act(() => { render(<Breakpoint/>, container); });
        expect(container.textContent).toBe("xl");
    });

    it("removes its resize listener when unmounted", () => {
        const remove = jest.spyOn(window, "removeEventListener");
        act(() => { render(<Breakpoint/>, container); });
        act(() => { unmountComponentAtNode(container); });
        expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
        remove.mockRestore();
    });
});
