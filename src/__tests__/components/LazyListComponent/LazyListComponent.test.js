/* eslint react/prop-types: off */
import React, {act} from "react";
import {Provider} from "react-redux";
import {createStore} from "redux";
import {vi} from "vitest";
import {render, unmount} from "../../render";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import reducer from "../../../components/LazyListComponent/lazyListComponentReducer";

vi.mock("../../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../../components/ListItemComponent", () => ({default: () => null}));
vi.mock("../../../components/ProgressView", () => ({default: {SHOW: {type: "show"}, HIDE: {type: "hide"}}}));
vi.mock("react-intersection-observer", () => ({
    InView: ({onChange}) => <button data-observer onClick={() => onChange(true)}>next</button>,
}));

const deferred = () => {
    let resolvePromise;
    const promise = new Promise(resolve => { resolvePromise = resolve; });
    return {promise, resolve: resolvePromise};
};
const entry = key => ({key, value: key});
const transform = async item => ({children: item.value});
const Item = ({children}) => <article>{children}</article>;
const makeCursor = pages => {
    let index = 0;
    const cursor = {
        id: Math.random(),
        order: "asc",
        position: {finished: false},
        next: vi.fn(async () => {
            const page = await pages[index];
            index++;
            cursor.position.finished = index >= pages.length;
            return page;
        })
    };
    return cursor;
};

let container, actions, store;
beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    actions = [];
    store = createStore((state = {}, action) => { actions.push(action.type); return state; });
});
afterEach(() => {
    unmount(container);
    container.remove();
});
const show = async props => {
    await act(async () => render(
        <React.Fragment>
            <Provider store={store}>
                <LazyListComponent
                    ItemComponent={Item}
                    itemTransform={transform}
                    placeholder={<span>loading</span>}
                    {...props}
                />
            </Provider>
        </React.Fragment>, container));
};
const rows = () => [...container.querySelectorAll("article")].map(node => node.textContent);
const next = async () => {
    const observer = container.querySelector("[data-observer]");
    expect(observer).not.toBeNull();
    await act(async () => observer.click());
};

it("keeps loaded rows and cursor position on a parent render", async () => {
    const cursor = makeCursor([[entry("a")], [entry("b")]]);
    await show({cursor});
    await next();
    await show({cursor, itemTransform: async item => ({children: item.value})});
    expect(cursor.next).toHaveBeenCalledExactlyOnceWith(10);
    expect(rows()).toEqual(["a"]);
    await next();
    expect(rows()).toEqual(["a", "b"]);
});

it("passes the configured page size to the cursor", async () => {
    const cursor = makeCursor([[entry("a")]]);
    await show({cursor, page: 25});
    await next();
    expect(cursor.next).toHaveBeenCalledExactlyOnceWith(25);
});

it("continues after every item in a page is skipped", async () => {
    const cursor = makeCursor([[entry("skip")], [entry("visible")]]);
    await show({cursor, itemTransform: async item => item.key === "skip" ? null : transform(item)});
    await next();
    expect(rows()).toEqual([]);
    await next();
    expect(rows()).toEqual(["visible"]);
    expect(container.querySelector("[data-observer]")).toBeNull();
});

it("ignores a page returned by an obsolete cursor", async () => {
    const old = deferred();
    await show({cursor: makeCursor([old.promise])});
    await next();
    await show({cursor: makeCursor([[entry("new")]])});
    await next();
    await act(async () => old.resolve([entry("old")]));
    expect(rows()).toEqual(["new"]);
    expect(actions.filter(type => type === "show")).toHaveLength(2);
    expect(actions.filter(type => type === "hide")).toHaveLength(2);
});

it("waits for all transformations and preserves page order", async () => {
    const slow = deferred();
    await show({cursor: makeCursor([[entry("a"), entry("b")]]), itemTransform: item => item.key === "a" ? slow.promise : transform(item)});
    await next();
    expect(rows()).toEqual([]);
    await act(async () => slow.resolve({children: "a"}));
    expect(rows()).toEqual(["a", "b"]);
});

it("does not retain rows after unmount", async () => {
    await show({cursor: makeCursor([[entry("old")]])});
    await next();
    unmount(container);
    await show({cursor: makeCursor([[entry("new")]])});
    expect(rows()).toEqual([]);
    await next();
    expect(rows()).toEqual(["new"]);
});

it("applies live events by key and unsubscribes without restarting traversal", async () => {
    const cursor = makeCursor([[entry("a")]]);
    cursor.order = "desc";
    let listener;
    const unsubscribe = vi.fn();
    cursor.subscribe = vi.fn(callback => { listener = callback; return {unsubscribe}; });
    await show({cursor, live: true});
    await next();
    await act(async () => listener({type: "add", entry: entry("b")}));
    await act(async () => listener({type: "add", entry: entry("b")}));
    expect(rows()).toEqual(["b", "a"]);
    await act(async () => listener({type: "change", entry: {key: "a", value: "changed"}}));
    await act(async () => listener({type: "remove", entry: entry("b")}));
    expect(rows()).toEqual(["changed"]);
    await show({cursor, live: false});
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(cursor.next).toHaveBeenCalledTimes(1);
});

it.each([reducer.REFRESH, reducer.RESET])("leaves cursor lifecycle to the page for %s", type => {
    const reset = vi.fn();
    const saved = Object.freeze({cursor: {reset}});
    const state = Object.freeze({LazyListComponent_profile: saved});
    expect(reducer(state, {type, cache: "profile"})).toBe(state);
    expect(reducer(state, {type})).toBe(state);
    expect(reset).not.toHaveBeenCalled();
});
