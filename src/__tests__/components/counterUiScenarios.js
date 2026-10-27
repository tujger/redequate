import {knownCounterFailure} from "../controllers/knownCounterFailure";
import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {vi} from "vitest";
import counterControl from "../../controllers/counterControl";

export function counterUiScenarios(Component, context, createDatabases) {
    let container, root, database, other;
    const path = [{id: "audit-ui"}, "replied"];
    const render = props => act(async () => root.render(React.createElement(Component, {path, live: true, showZero: true, ...props})));
    const write = async (operation, target = other, address = path) => {
        await act(async () => { await counterControl({database: target, path: address, ...operation}); });
    };
    const displayed = async value => {
        await vi.waitFor(async () => {
            await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
            expect(container.textContent).toBe(value);
        });
    };
    beforeEach(async () => {
        [database, other] = await createDatabases();
        context.database = database;
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    });

    it("renders real provider events through increment, decrement and removal", async () => {
        await render(); await displayed("0");
        await write({increment: 2}); await displayed("2");
        await write({decrease: 1}); await displayed("1");
        await write({decrease: 1}); await displayed("0");
        await render({showZero: false}); await displayed("");
    });
    it("renders supplied counter values and zero decorations without a subscription", async () => {
        const subscribe = vi.spyOn(database, "addEventListener");
        await render({path: undefined, live: false, counter: 3, prefix: "[", suffix: "]"});
        expect(container.textContent).toBe("[3]");
        await render({path: undefined, live: false, counter: 0, zeroPrefix: "zero:", zeroSuffix: "!"});
        expect(container.textContent).toBe("zero:0!");
        expect(subscribe).not.toHaveBeenCalled();
    });
    it("keeps the existing counter-plus-path subscription behavior when live is false", async () => {
        await render({counter: 2, live: false});
        await write({value: 6}); await displayed("6");
    });
    it("moves the real subscription to another path", async () => {
        await render(); await write({increment: 2}); await displayed("2");
        const second = [{id: "audit-ui-other"}, "replied"];
        await render({path: second}); await displayed("0");
        await write({increment: 3}, other, second); await displayed("3");
        await write({increment: 1}); expect(container.textContent).toBe("3");
    });
    it("cleans up a real subscription in StrictMode and on unmount", async () => {
        const onChange = vi.fn();
        await act(async () => root.render(React.createElement(React.StrictMode, null,
            React.createElement(Component, {path, live: true, showZero: true, onChange}))));
        await displayed("0");
        await write({increment: 1}); await displayed("1");
        const calls = onChange.mock.calls.length;
        await act(async () => root.render(null));
        await write({increment: 1});
        expect(container.textContent).toBe("");
        expect(onChange).toHaveBeenCalledTimes(calls);
    });
    knownCounterFailure("C3: enabling live with the same path starts the subscription", async () => {
        await render({live: false});
        await write({increment: 2});
        await render({live: true});
        await displayed("2");
    });
    knownCounterFailure("C3: disabling live removes the subscription", async () => {
        await render(); await write({increment: 2}); await displayed("2");
        await render({live: false});
        await write({increment: 1});
        expect(await counterControl({database, path})).toBe(3);
        // Read back before asserting DOM to allow the provider event to settle.
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
        expect(container.textContent).toBe("2");
    });
    knownCounterFailure("C4: changing database with the same path follows the new provider", async () => {
        await render(); await write({increment: 2}); await displayed("2");
        const [replacement] = await createDatabases("replacement");
        const subscribe = vi.spyOn(replacement, "addEventListener");
        context.database = replacement;
        await render();
        expect(subscribe).toHaveBeenCalledOnce();
        await write({value: 7}, replacement); await displayed("7");
    });
    knownCounterFailure("C5: changing only onChange uses the latest callback", async () => {
        const old = vi.fn(), latest = vi.fn();
        await render({onChange: old});
        await write({increment: 1}); await displayed("1");
        old.mockClear();
        await render({onChange: latest});
        await write({increment: 1}); await displayed("2");
        expect(latest).toHaveBeenCalledWith(2, 1);
        expect(old).not.toHaveBeenCalled();
    });
}
