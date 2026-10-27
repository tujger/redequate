import {vi} from "vitest";
import {Provider, useSelector} from "react-redux";
import {combineReducers, createStore} from "redux";
import React, {act} from "react";
import reducer from "../../../components/LazyListComponent/lazyListComponentReducer";
import {render, unmount} from "../../render";
import MutualList from "../../../components/MutualComponent/MutualList";
import {MutualListMode} from "../../../components/MutualComponent/MutualConstants";
import dispatcherRoutedBodyReducer from "../../../reducers/dispatcherRoutedBodyReducer";
import {Layout} from "../../../controllers/General";

const context = vi.hoisted(() => ({database: {cursor: vi.fn()}, props: undefined, dispatch: vi.fn()}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value})}));
vi.mock("../../../controllers", () => ({useDatabase: () => context.database}));
vi.mock("../../../controllers/General", () => ({cacheDatas: {}, Layout: {REFRESH: "layout_Refresh"}}));
vi.mock("../../../controllers/UserData", () => ({default: class {}}));
vi.mock("../../../components/ItemPlaceholderComponent", () => ({default: () => null}));
vi.mock("../../../components/MutualComponent/MutualRequestItem", () => ({default: () => null}));
vi.mock("../../../components/MutualComponent/MutualSubscribeItem", () => ({default: () => null}));
vi.mock("../../../components/LazyListComponent/LazyListComponent", () => ({default: props => { context.props = props; return null; }}));

let container, store;
beforeEach(() => {
    container = document.createElement("div");
    context.database = {cursor: vi.fn(() => ({}))};
    context.dispatch.mockClear();
    store = createStore(combineReducers({lazyListComponentReducer: reducer, dispatcherRoutedBodyReducer}));
});
afterEach(() => unmount(container));

it("creates a fresh cursor on parent renders and when query inputs change", () => {
    const props = {mode: MutualListMode.SELF, mutualId: "u1", typeId: "following"};
    const show = current => render(<React.Fragment><Provider store={store}><MutualList {...current}/></Provider></React.Fragment>, container);
    show(props);
    const cursor = context.props.cursor;
    show({...props, itemTransform: item => item});
    expect(context.props.cursor).not.toBe(cursor);
    expect(context.database.cursor).toHaveBeenCalledTimes(2);
    expect(context.database.cursor).toHaveBeenLastCalledWith(["mutualstamps", {mutual_type: "_my"}, {user_id: "u1"}, "mutual_id"], {order: "desc"});
    show({...props, mutualId: "u2"});
    expect(context.database.cursor).toHaveBeenLastCalledWith(["mutualstamps", {mutual_type: "_my"}, {user_id: "u2"}, "mutual_id"], {order: "desc"});
});

it("restarts through the existing layout remount without revision state", () => {
    const unmounted = vi.fn();
    const Page = () => {
        React.useEffect(() => unmounted, []);
        return <MutualList mode={MutualListMode.SELF} mutualId="u1" typeId="following"/>;
    };
    const RoutedBody = () => {
        const random = useSelector(state => state.dispatcherRoutedBodyReducer.random);
        return <Page key={random}/>;
    };
    render(<React.Fragment><Provider store={store}><RoutedBody/></Provider></React.Fragment>, container);
    const cursor = context.props.cursor;
    expect(context.database.cursor).toHaveBeenCalledTimes(1);
    act(() => store.dispatch({type: Layout.REFRESH}));
    expect(context.props.cursor).not.toBe(cursor);
    expect(context.database.cursor).toHaveBeenCalledTimes(2);
    expect(unmounted).toHaveBeenCalledTimes(1);
    expect(store.getState().lazyListComponentReducer).toEqual({});
});

it("requests page remount after changing a subscription", () => {
    render(<React.Fragment><Provider store={store}><MutualList mode={MutualListMode.SUBSCRIBES} mutualId="u1" typeId="watching"/></Provider></React.Fragment>, container);
    const before = store.getState().dispatcherRoutedBodyReducer.random;
    act(() => context.props.ItemComponent({key: "m1", value: {type: "tag"}}).props.onDelete());
    expect(store.getState().dispatcherRoutedBodyReducer.random).not.toBe(before);
    expect(store.getState().lazyListComponentReducer).toEqual({});
});
