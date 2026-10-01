import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import Menu from "../../controls/Menu/Menu";

describe("Menu", () => {
    let container;
    let viewportHeight;

    beforeEach(() => {
        jest.useFakeTimers();
        viewportHeight = window.innerHeight;
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
        Object.defineProperty(window, "innerHeight", {configurable: true, value: viewportHeight});
        jest.useRealTimers();
    });

    const show = props => {
        act(() => {
            render(<Menu {...props} anchorEl={container} autoFocus={false} role={null}>
                {({options}) => options.length
                    ? options.map(option => <div key={option}>{option}</div>)
                    : <div role="status">Loading</div>}
            </Menu>, container);
        });
    };

    it("loads only after opening when options are not supplied", async () => {
        const load = jest.fn().mockResolvedValue(["First"]);
        show({load, open: false, reloadKey: "first"});
        expect(load).not.toHaveBeenCalled();
        show({load, open: true, reloadKey: "first"});
        expect(load).toHaveBeenCalledTimes(1);
        await act(async () => { await Promise.resolve(); });
        expect(document.body.textContent).toContain("First");
        show({load, open: true, options: ["Supplied"], reloadKey: "second"});
        expect(load).toHaveBeenCalledTimes(1);
        expect(document.body.textContent).toContain("Supplied");
    });

    it("renders inline at its call site with every nested level visible", () => {
        const labels = [];
        act(() => {
            render(<Menu inline items={[
                {label: "First"},
                [{label: "Hidden selector"}, {label: "Second"},
                    [{label: "Hidden deeper selector"}, {label: "Third"}]],
                [{label: "Single"}],
            ]} renderItem={item => {
                labels.push(item.label);
                return <div role="menuitem" tabIndex={-1}>{item.label}</div>;
            }}/>, container);
        });

        const menu = container.querySelector('[role="menu"]');
        expect(menu).not.toBeNull();
        expect(menu.parentElement).toBe(container);
        expect(menu.style.position).toBe("");
        expect(Array.from(menu.querySelectorAll('[role="menuitem"]')).map(item => item.textContent))
            .toEqual(["First", "Second", "Third", "Single"]);
        expect(labels).not.toContain("Hidden selector");
        expect(labels).not.toContain("Hidden deeper selector");
    });

    it("keeps old options for one second, then shows loading until the replacement arrives", async () => {
        let resolveNext;
        const load = jest.fn()
            .mockResolvedValueOnce(["First"])
            .mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve; }));
        show({load, open: true, reloadKey: "first", staleMs: 1000});
        await act(async () => { await Promise.resolve(); });
        expect(document.body.textContent).toContain("First");

        show({load, open: true, reloadKey: "second", staleMs: 1000});
        act(() => { jest.advanceTimersByTime(999); });
        expect(document.body.textContent).toContain("First");
        act(() => { jest.advanceTimersByTime(1); });
        expect(document.body.querySelector('[role="status"]')).not.toBeNull();
        expect(document.body.textContent).not.toContain("First");

        await act(async () => {
            resolveNext(["Second"]);
            await Promise.resolve();
        });
        expect(document.body.textContent).toContain("Second");
    });

    it("aborts an old load and ignores its late result", async () => {
        let resolveOld;
        const load = jest.fn()
            .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
            .mockResolvedValueOnce(["New"]);
        show({load, open: true, reloadKey: "old"});
        const oldSignal = load.mock.calls[0][0].signal;
        show({load, open: true, reloadKey: "new"});
        expect(oldSignal.aborted).toBe(true);
        await act(async () => {
            resolveOld(["Old"]);
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(document.body.textContent).toContain("New");
        expect(document.body.textContent).not.toContain("Old");
    });

    it("aligns origin points and preserves the default gap", () => {
        container.getBoundingClientRect = () => ({left: 100, right: 180, top: 100, bottom: 140, width: 80, height: 40});
        show({open: true});
        const menu = document.body.querySelector('[role="status"]').parentElement;
        Object.defineProperties(menu, {
            offsetWidth: {configurable: true, value: 120},
            scrollHeight: {configurable: true, value: 80},
        });
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.left).toBe("100px");
        expect(menu.style.top).toBe("148px");

        show({open: true, offset: 0,
            anchorOrigin: {vertical: "bottom", horizontal: "right"},
            transformOrigin: {vertical: "top", horizontal: "right"}});
        expect(menu.style.left).toBe("60px");
        expect(menu.style.top).toBe("140px");
        expect(menu.style.transformOrigin).toBe("120px 0px");

        show({open: true, offset: 0,
            anchorOrigin: {vertical: "top", horizontal: "center"},
            transformOrigin: {vertical: "bottom", horizontal: "center"}});
        expect(menu.style.left).toBe("80px");
        expect(menu.style.top).toBe("20px");
        expect(menu.style.transformOrigin).toBe("60px 80px");
    });

    it("supports numeric origins and keeps the menu inside the screen horizontally", () => {
        let left = 100;
        container.getBoundingClientRect = () => ({left, right: left + 80, top: 200, bottom: 240, width: 80, height: 40});
        show({open: true, offset: 7,
            anchorOrigin: {vertical: 10, horizontal: 20},
            transformOrigin: {vertical: 5, horizontal: 8}});
        const menu = document.body.querySelector('[role="status"]').parentElement;
        Object.defineProperties(menu, {
            offsetWidth: {configurable: true, value: 120},
            scrollHeight: {configurable: true, value: 80},
        });
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.left).toBe("112px");
        expect(menu.style.top).toBe("205px");
        expect(menu.style.transformOrigin).toBe("8px 5px");

        left = window.innerWidth - 40;
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.left).toBe(`${window.innerWidth - 128}px`);
    });

    it("flips to the roomier vertical side and scrolls when neither side fits", () => {
        Object.defineProperty(window, "innerHeight", {configurable: true, value: 300});
        let top = 100;
        container.getBoundingClientRect = () => ({left: 100, right: 180, top, bottom: top + 40, width: 80, height: 40});
        show({open: true});
        const menu = document.body.querySelector('[role="status"]').parentElement;
        Object.defineProperties(menu, {
            offsetWidth: {configurable: true, value: 120},
            scrollHeight: {configurable: true, value: 200},
        });
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.top).toBe("148px");
        expect(menu.style.maxHeight).toBe("144px");
        expect(menu.style.overflowY).toBe("auto");

        top = 220;
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.top).toBe("12px");
        expect(menu.style.maxHeight).toBe("204px");
        expect(menu.style.overflowY).toBe("");
        expect(menu.style.transformOrigin).toBe("0px 200px");
    });
});
