/* eslint react/jsx-uses-vars: "error", react/jsx-uses-react: "error" */
import React, {act, memo, StrictMode} from "react";
import {vi} from "vitest";
import {hydrateRoot} from "react-dom/client";
import {renderToString} from "react-dom/server";
import AppContext from "../../../controllers/AppContext/AppContext";
import {createAppState, globalAppState} from "../../../controllers/AppContext/AppState";
import UseAbstract from "../../../controllers/AppContext/UseAbstract";
import GlobalStore from "../../../controllers/AppContext/GlobalStore";
import {UserData} from "../../../controllers/UserData";
import {getCurrentUserData, useCurrentUserData} from "../../../controllers/useCurrentUserData";
import {render, unmount} from "../../render";

let sequence = 0;
const makeHook = initial => new UseAbstract(`context-${sequence++}`, initial);
let container;
beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
});
afterEach(() => {
    unmount(container);
    container.remove();
});

it("registers immediately, creates local stores lazily and freezes captured seeds", () => {
    const hook = makeHook({count: 1});
    expect(hook.get()).toEqual({count: 1});
    const seeds = {[hook._key]: {count: 2}};
    const state = createAppState(seeds);
    const fork = vi.spyOn(hook._store, "fork");
    seeds[hook._key] = {count: 3};
    expect(fork).not.toHaveBeenCalled();
    expect(hook.get(state)).toEqual({count: 2});
    expect(() => { hook.get(state).count++; }).toThrow(TypeError);
    expect(state.store(hook._key)).toBe(state.store(hook._key));
    expect(fork).toHaveBeenCalledTimes(1);
    expect(hook.get()).toEqual({count: 1});
    expect(() => state.store("unknown")).toThrow("Unknown global store");
});

it("does not normalize registered defaults again when creating a local store", () => {
    class Counter extends UseAbstract {
        _normalize(value) { return value + 1; }
    }
    const hook = new Counter(`normalized-${sequence++}`, 0);
    const state = createAppState();
    expect(hook.get(state)).toBe(1);
    hook.set(previous => previous + 1, state);
    expect(hook.get(state)).toBe(3);
    hook.reset(state);
    expect(hook.get(state)).toBe(1);
});

it("shares browser state inside and outside the default provider across remounts", () => {
    const hook = makeHook(1);
    const observed = [];
    const Probe = () => {
        const [value, set] = hook.useStore();
        observed.push({value, set});
        return <span>{value}</span>;
    };
    render(<Probe/>, container);
    expect(observed.at(-1).set).toBe(globalAppState.store(hook._key).set);
    act(() => hook.set(previous => previous + 1));
    expect(container.textContent).toBe("2");
    unmount(container);
    render(<AppContext><Probe/></AppContext>, container);
    expect(container.textContent).toBe("2");
    expect(observed.at(-1).set).toBe(observed[0].set);
});

it("uses explicit state and the nearest provider with stable state for the mount", () => {
    const hook = makeHook(1);
    const outer = createAppState({[hook._key]: 2});
    const inner = createAppState({[hook._key]: 3});
    const alternate = createAppState({[hook._key]: 9});
    const Probe = () => <span>{hook.useValue()}</span>;
    const tree = state => React.createElement(AppContext, {state, initialState: {[hook._key]: 8}},
        <Probe/>, <AppContext state={inner}><Probe/></AppContext>, <Probe/>);
    render(tree(outer), container);
    expect(container.textContent).toBe("232");
    act(() => hook.set(4, inner));
    expect(container.textContent).toBe("242");
    render(tree(alternate), container);
    expect(container.textContent).toBe("242");
    expect(hook.get()).toBe(1);
});

it("keeps initialState for the mount and creates a new local state after remount", () => {
    const hook = makeHook(0);
    const Probe = () => <span>{hook.useValue()}</span>;
    render(<AppContext initialState={{[hook._key]: 1}}><Probe/></AppContext>, container);
    render(<AppContext initialState={{[hook._key]: 2}}><Probe/></AppContext>, container);
    expect(container.textContent).toBe("1");
    unmount(container);
    render(<AppContext initialState={{[hook._key]: 2}}><Probe/></AppContext>, container);
    expect(container.textContent).toBe("2");
    expect(hook.get()).toBe(0);
});

it("keeps subscriptions stable and cleans them up in StrictMode", () => {
    const hook = makeHook(0);
    const store = globalAppState.store(hook._key);
    const subscribe = vi.spyOn(store, "subscribe");
    let renders = 0;
    const Probe = () => { renders++; return <span>{hook.useValue()}</span>; };
    render(<StrictMode><Probe/></StrictMode>, container);
    const subscriptions = subscribe.mock.calls.length;
    act(() => hook.set(1));
    expect(container.textContent).toBe("1");
    expect(subscribe).toHaveBeenCalledTimes(subscriptions);
    expect(store._listeners.size).toBe(1);
    const before = renders;
    act(() => hook.set(1));
    expect(renders).toBe(before);
    unmount(container);
    expect(store._listeners.size).toBe(0);
    act(() => hook.set(2));
    expect(renders).toBe(before);
});

it("updates only the changed hook among 500 independent hooks and leaves useSet unsubscribed", () => {
    const hooks = Array.from({length: 500}, () => makeHook(0));
    const renders = hooks.map(() => 0);
    let setterRenders = 0;
    let set;
    // eslint-disable-next-line react/prop-types -- Test probe receives an array index.
    const Probe = ({index}) => {
        renders[index]++;
        return <span>{hooks[index].useValue()}</span>;
    };
    const Setter = () => { setterRenders++; set = hooks[211].useSet(); return null; };
    render(<AppContext>{hooks.map((hook, index) => <Probe key={hook._key} index={index}/>)}<Setter/></AppContext>, container);
    expect(renders).toEqual(hooks.map(() => 1));
    act(() => set(1));
    expect(renders.filter(count => count === 2)).toHaveLength(1);
    expect(renders[211]).toBe(2);
    expect(setterRenders).toBe(1);
    expect(hooks[211]._store._listeners.size).toBe(1);
});

it("does not update memoized context readers when provider inputs are unchanged", () => {
    const hook = makeHook(0);
    const value = {auth: {}};
    let renders = 0;
    const Probe = memo(() => { renders++; hook.useSet(); return null; });
    render(<AppContext value={value}><Probe/></AppContext>, container);
    render(<AppContext value={value}><Probe/></AppContext>, container);
    expect(renders).toBe(1);
    render(<AppContext value={{auth: {}}}><Probe/></AppContext>, container);
    expect(renders).toBe(2);
});

it.each(["initialState", "state"])("hydrates a transferred %s snapshot and then applies current updates", async prop => {
    const hook = makeHook({count: 0});
    const initialState = {[hook._key]: {count: 4}};
    const serverState = createAppState(initialState);
    const Probe = () => <span>{hook.useValue().count}</span>;
    container.innerHTML = renderToString(<AppContext state={serverState}><Probe/></AppContext>);
    const firstNode = container.firstChild;
    const transferred = JSON.parse(JSON.stringify(initialState));
    const clientState = createAppState(transferred);
    const errors = vi.fn();
    // Hydration reads the baseline even if the current state has advanced.
    if (prop === "state") hook.set({count: 5}, clientState);
    let root;
    try {
        await act(async () => {
            root = hydrateRoot(container, <AppContext {...(prop === "state" ? {state: clientState} : {initialState: transferred})}><Probe/></AppContext>, {onRecoverableError: errors});
        });
        expect(errors).not.toHaveBeenCalled();
        expect(container.firstChild).toBe(firstNode);
        expect(container.textContent).toBe(prop === "state" ? "5" : "4");
        if (prop === "state") {
            act(() => hook.set({count: 6}, clientState));
            expect(container.textContent).toBe("6");
            expect(clientState.store(hook._key).getServerSnapshot()).toEqual({count: 4});
        }
        expect(hook.get()).toEqual({count: 0});
    } finally {
        if (root) await act(async () => root.unmount());
    }
});

it("preserves UserData model APIs, freezes its own state and leaves private visit bookkeeping usable", async () => {
    const database = {read: vi.fn().mockResolvedValue("user@example.test"), write: vi.fn().mockResolvedValue(), TIMESTAMP: {kind: "server-timestamp"}};
    const user = new UserData(database).create("visit-user", {name: "User", email: "user@example.test"});
    user._getState().persisted = true;
    const store = new GlobalStore(user);
    expect(store.get()).toBe(user);
    expect(user).toBeInstanceOf(UserData);
    expect(user.toJSON().public.name).toBe("User");
    expect(() => user.update({name: "Mutation"})).toThrow(TypeError);
    expect(Object.isFrozen(user._getState())).toBe(true);
    expect(Object.isFrozen(database)).toBe(false);
    expect(user.updateVisitTimestamp(database)).toBe(user);
    await vi.waitFor(() => expect(database.write).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    user.updateVisitTimestamp(database);
    expect(database.read).toHaveBeenCalledTimes(1);
    const json = user.toJSON();
    json.public.name = "Replacement";
    const replacement = new UserData(database).fromJSON(json);
    store.set(replacement);
    expect(store.get().name).toBe("Replacement");
    expect(user.name).toBe("User");
});

it("publishes replacement user models, locale updates and anonymous logout values", async () => {
    const state = createAppState();
    let set;
    const Probe = () => {
        const [user, setUser] = useCurrentUserData();
        set = setUser;
        return <span>{user.id || "anonymous"}:{user.private.device?.locale || "none"}</span>;
    };
    render(<AppContext state={state}><Probe/></AppContext>, container);
    const signedIn = new UserData().create("signed-in", {name: "User"});
    await signedIn.setPrivate("device", {locale: "en"});
    act(() => set(signedIn));
    expect(getCurrentUserData(state)).toBe(signedIn);
    expect(container.textContent).toBe("signed-in:en");
    const edited = new UserData().fromJSON(signedIn.toJSON());
    await edited.setPrivate("device", {locale: "ru"});
    act(() => set(edited));
    expect(container.textContent).toBe("signed-in:ru");
    act(() => set(null));
    expect(container.textContent).toBe("anonymous:none");
    expect(getCurrentUserData(state)).toBeInstanceOf(UserData);
});
