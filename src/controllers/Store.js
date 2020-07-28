import ProgressView, {progressViewReducer} from "../components/ProgressView";
import {snackbarReducer} from "../components/Snackbar";
import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";
import {currentUserData} from "./UserData";
import {mainAppbarReducer} from "../components/MainAppbar";
import {usersReducer} from "../pages/admin/Users";
import LazyListComponent, {lazyListComponentReducer} from "../components/LazyListComponent";
import {topMenuReducer} from "../components/TopMenu";
import {dispatcherRoutedBodyReducer} from "../Dispatcher";
import {chatsCounterReducer} from "../chat";
import {errorsReducer} from "../pages/admin/Errors";

const Store = (name, reducers) => {
    const initialStore = JSON.parse(window.localStorage.getItem(name));
    reducers = {
        chatsCounterReducer,
        currentUserData,
        dispatcherRoutedBodyReducer,
        errors: errorsReducer,
        lazyListComponentReducer,
        mainAppbarReducer,
        progressView: progressViewReducer,
        snackbar: snackbarReducer,
        topMenuReducer,
        users: usersReducer,
        ...reducers};
    const store = createStore(combineReducers(reducers), initialStore || {});

    store.subscribe(() => {
        const saveable = {};
        for(let x in store.getState()) {
            if(reducers[x] && !reducers[x].skipStore) {
                saveable[x] = store.getState()[x];
            }
        }
        window.localStorage.setItem(name, JSON.stringify(saveable));
    });
    return store;
};

Store.propTypes = {
    name: PropTypes.string,
    reducers: PropTypes.array,
};

export default Store;

export const refreshAll = store => {
    console.warn("[Store] refresh")
    store.dispatch({type: Layout.REFRESH});
    store.dispatch({type: LazyListComponent.RESET});
    store.dispatch({type: LazyListComponent.RESET, cache: "chats"});
    store.dispatch({type: MenuBadge.RESET});
    // store.dispatch(ResponsiveDrawerLayout.REFRESH);
    // store.dispatch(TopBottomMenuLayout.REFRESH);
    // store.dispatch(BottomToolbarLayout.REFRESH);
    store.dispatch(ProgressView.HIDE);
};

export const MenuBadge = {
    INCREASE: "badge_Increase",
    DECREASE: "badge_Decrease",
    RESET: "badge_Reset",
    VALUE: "badge_Value",
}

export const Layout = {
    REFRESH: "layout_Refresh",
}
