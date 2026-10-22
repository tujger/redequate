import React from "react";
import {vi} from "vitest";
import {Provider} from "react-redux";
import {combineReducers, createStore} from "redux";
import {MemoryRouter} from "react-router-dom";
import Tags from "../../tags/Tags";
import {tagsReducer} from "../../tags/tagsReducer";
import {lazyListComponentReducer} from "../../components/LazyListComponent/lazyListComponentReducer";
import {database, firebase, seedDatabase} from "../common";
import {render, unmount} from "../render";

const context = vi.hoisted(() => ({database: undefined, cursor: undefined}));
vi.mock("../../controllers", () => ({useDatabase: () => context.database}));
vi.mock("../../controllers/General", () => ({cacheDatas: {}, usePages: () => ({newtag: {route: "/new/tag"}})}));
vi.mock("../../components/LazyListComponent/LazyListComponent", () => ({default: props => { context.cursor = props.cursor; return null; }}));
vi.mock("../../components/FlexFabComponent", () => ({default: () => null}));
vi.mock("../../components/ItemPlaceholderComponent", () => ({default: () => null}));
vi.mock("../../components/MentionedTextComponent", () => ({default: () => null}));
vi.mock("../../components/MutualComponent/MutualSubscribeItem", () => ({default: () => null}));
vi.mock("../../components/NavigationToolbar", () => ({default: () => null}));
vi.mock("../../controls/Select/Select", () => ({default: () => null}));
vi.mock("../../controls/TextField/TextField", () => ({default: () => null}));

let container;
const records = Object.fromEntries(Array.from({length: 12}, (_, index) => {
    const id = `t${String(index).padStart(2, "0")}`;
    return [id, {id, label: id, _sort_name: id, uid: "u1", hidden: true}];
}));
beforeEach(async () => {
    container = document.createElement("div");
    context.database = database;
    await seedDatabase({tag: {missing: {id: "missing"}, empty: {_sort_name: ""}, ...records}});
});
afterEach(() => unmount(container));

const mount = (state = {mode: "all", filter: ""}, props = {}) => {
    const store = createStore(combineReducers({tags: tagsReducer, lazyListComponentReducer}), {tags: state});
    render(<React.Fragment><MemoryRouter><Provider store={store}><Tags {...props}/></Provider></MemoryRouter></React.Fragment>, container);
    return context.cursor;
};

it("reads the first ten sorted tags in one bounded request and continues without duplicates", async () => {
    const ref = firebase.database().ref();
    const once = vi.spyOn(Object.getPrototypeOf(ref.orderByKey()), "once");
    const cursor = mount();
    expect((await cursor.next(10)).map(entry => entry.key)).toEqual(Object.keys(records).slice(0, 10));
    expect(once).toHaveBeenCalledTimes(1);
    expect((await cursor.next(10)).map(entry => entry.key)).toEqual(["t10", "t11"]);
    expect(once).toHaveBeenCalledTimes(2);
    expect(cursor.position.finished).toBe(true);
});

it("preserves prefix search", async () => {
    expect((await mount({mode: "all", filter: "t1"}).next(10)).map(entry => entry.key)).toEqual(["t10", "t11"]);
});

it("preserves exact equality without adding range endpoints", async () => {
    expect((await mount(undefined, {equals: "t05"}).next(10)).map(entry => entry.key)).toEqual(["t05"]);
});

it("preserves hidden-tag selection", async () => {
    expect((await mount({mode: "hidden", filter: ""}).next(20)).map(entry => entry.key)).toEqual(Object.keys(records));
});

it("preserves owner selection", async () => {
    expect((await mount({mode: "uid", filter: ""}, {equals: "u1"}).next(20)).map(entry => entry.key)).toEqual(Object.keys(records));
});

it("finishes an empty list without an additional read", async () => {
    await seedDatabase({tag: {missing: {id: "missing"}}});
    const cursor = mount();
    expect(await cursor.next(10)).toEqual([]);
    expect(cursor.position.finished).toBe(true);
});
