import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import Menu from "../../controls/Menu/Menu";

describe("Menu lazy loading", () => {
    let container;

    beforeEach(() => {
        jest.useFakeTimers();
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
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
});
