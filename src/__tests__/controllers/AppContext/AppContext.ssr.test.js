// @vitest-environment node
/* eslint react/jsx-uses-vars: "error", react/jsx-uses-react: "error" */
import React from "react";
import {renderToString} from "react-dom/server";
import AppContext from "../../../controllers/AppContext/AppContext";
import {createAppState, globalAppState} from "../../../controllers/AppContext/AppState";
import UseAbstract from "../../../controllers/AppContext/UseAbstract";

let sequence = 0;
const makeHook = initial => new UseAbstract(`ssr-${sequence++}`, initial);

it("rejects implicit and explicit shared server access for get, set and reset", () => {
    const hook = makeHook(0);
    expect(() => hook.get()).toThrow("SSR requires an explicit AppState");
    expect(() => hook.set(1)).toThrow("SSR requires an explicit AppState");
    expect(() => hook.reset()).toThrow("SSR requires an explicit AppState");
    expect(() => hook.get(globalAppState)).toThrow("SSR requires an explicit AppState");
    const Probe = () => <span>{hook.useValue()}</span>;
    expect(() => renderToString(<Probe/>)).toThrow("SSR requires AppContext");
    expect(() => renderToString(<AppContext state={globalAppState}><Probe/></AppContext>)).toThrow("SSR requires an explicit AppState");
});

it("creates independent states for concurrent requests and renders their initial snapshots", async () => {
    const hook = makeHook({count: 0});
    const Probe = () => <span>{hook.useValue().count}</span>;
    const states = await Promise.all([1, 2].map(async count => {
        await Promise.resolve();
        const state = createAppState({[hook._key]: {count}});
        const html = renderToString(<AppContext state={state}><Probe/></AppContext>);
        return {state, html};
    }));
    expect(states.map(request => request.html)).toEqual(["<span>1</span>", "<span>2</span>"]);
    hook.set(previous => ({count: previous.count + 10}), states[0].state);
    expect(hook.get(states[0].state)).toEqual({count: 11});
    expect(hook.get(states[1].state)).toEqual({count: 2});
    expect(renderToString(<AppContext state={states[0].state}><Probe/></AppContext>)).toBe("<span>1</span>");
    hook.reset(states[0].state);
    expect(hook.get(states[0].state)).toEqual({count: 1});
});

it("creates local stores for every unseeded SSR provider and keeps defaults immutable", () => {
    const hook = makeHook({count: 1});
    const stores = [];
    const Probe = () => { stores.push(hook.useInstance()); return <span>{hook.useValue().count}</span>; };
    expect(renderToString(<AppContext><Probe/></AppContext>)).toBe("<span>1</span>");
    expect(renderToString(<AppContext><Probe/></AppContext>)).toBe("<span>1</span>");
    expect(stores[0]).not.toBe(stores[1]);
    expect(stores[0].get()).toBe(stores[1].get());
    expect(() => { stores[0].get().count++; }).toThrow(TypeError);
    stores[0].set({count: 2});
    expect(stores[1].get()).toEqual({count: 1});
    expect(stores[0]._listeners.size).toBe(0);
});

it("renders transferred seeds and selects the nearest SSR context", () => {
    const hook = makeHook(0);
    const initialState = {[hook._key]: 1};
    const Probe = () => <span>{hook.useValue()}</span>;
    const html = renderToString(
        <AppContext initialState={initialState}>
            <Probe/>
            <AppContext initialState={{[hook._key]: 2}}><Probe/></AppContext>
            <Probe/>
        </AppContext>
    );
    expect(html).toBe("<span>1</span><span>2</span><span>1</span>");
    const transferred = JSON.parse(JSON.stringify(initialState));
    expect(renderToString(<AppContext initialState={transferred}><Probe/></AppContext>)).toBe("<span>1</span>");
});
