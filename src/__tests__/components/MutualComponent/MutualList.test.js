import {vi} from "vitest";
import {Provider} from "react-redux";
import {combineReducers, createStore} from "redux";
import React, {act} from "react";
import {lazyListComponentReducer as reducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import {render, unmount} from "../../render";
import MutualList from "../../../components/MutualComponent/MutualList";
import {MutualListMode} from "../../../components/MutualComponent/MutualConstants";

const context = vi.hoisted(() => ({database: {cursor: vi.fn()}, props: undefined, dispatch: vi.fn()}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value})}));
vi.mock("../../../controllers", () => ({useDatabase: () => context.database}));
vi.mock("../../../controllers/General", () => ({cacheDatas: {}}));
vi.mock("../../../controllers/UserData", () => ({UserData: class {}}));
vi.mock("../../../components/ItemPlaceholderComponent", () => ({default: () => null}));
vi.mock("../../../components/MutualComponent/MutualRequestItem", () => ({default: () => null}));
vi.mock("../../../components/MutualComponent/MutualSubscribeItem", () => ({default: () => null}));
vi.mock("../../../components/LazyListComponent/LazyListComponent", () => ({default: props => { context.props = props; return null; }}));

let container, store;
beforeEach(() => {
    container = document.createElement("div");
    context.database = {cursor: vi.fn(() => ({}))};
    context.dispatch.mockClear();
    store = createStore(combineReducers({lazyListComponentReducer: reducer}));
});
afterEach(() => unmount(container));

it("keeps the cursor on parent renders and replaces it when query inputs change", () => {
    const props = {mode: MutualListMode.SELF, mutualId: "u1", typeId: "following"};
    render(<React.Fragment><Provider store={store}><MutualList {...props}/></Provider></React.Fragment>, container);
    const cursor = context.props.cursor;
    render(<Provider store={store}><MutualList {...props} itemTransform={item => item}/></Provider>, container);
    expect(context.props.cursor).toBe(cursor);
    expect(context.database.cursor).toHaveBeenCalledExactlyOnceWith(["mutualstamps", "_my", {user_id: "u1"}], {order: "desc"});
    expect(context.dispatch).not.toHaveBeenCalled();
    render(<Provider store={store}><MutualList {...props} mutualId="u2"/></Provider>, container);
    expect(context.props.cursor).not.toBe(cursor);
    expect(context.database.cursor).toHaveBeenLastCalledWith(["mutualstamps", "_my", {user_id: "u2"}], {order: "desc"});
});

it("replaces the cursor only for matching or global Refresh/RESET actions", () => {
    render(<Provider store={store}><MutualList mode={MutualListMode.SELF} mutualId="u1" typeId="following"/></Provider>, container);
    const cursor = context.props.cursor;
    act(() => store.dispatch({type: reducer.REFRESH, cache: "unrelated"}));
    expect(context.props.cursor).toBe(cursor);
    act(() => store.dispatch({type: reducer.REFRESH, cache: `following_${MutualListMode.SELF}_u1`}));
    expect(context.props.cursor).not.toBe(cursor);
    const refreshed = context.props.cursor;
    act(() => store.dispatch({type: reducer.RESET}));
    expect(context.props.cursor).not.toBe(refreshed);
});
