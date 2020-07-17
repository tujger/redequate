import ProgressView, {progressView} from "../components/ProgressView";
import ResponsiveDrawerLayout, {responsiveDrawerLayout} from "../layouts/ResponsiveDrawerLayout";
import TopBottomMenuLayout, {topBottomMenuLayout} from "../layouts/TopBottomMenuLayout";
import BottomToolbarLayout, {bottomToolbarLayout} from "../layouts/BottomToolbarLayout";
import {snackbar} from "../components/Snackbar";
import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";
import {currentUserData} from "./UserData";
import {mainAppbar} from "../components/MainAppbar";
import {usersReducer} from "../pages/admin/Users";
import {lazyListComponent} from "../components/LazyListComponent";

const Store = (name, reducers) => {
    const initialStore = JSON.parse(window.localStorage.getItem(name));
    reducers = {
        bottomToolbarLayout,
        currentUserData,
        lazyListComponent,
        mainAppbar,
        progressView,
        responsiveDrawerLayout,
        snackbar,
        topBottomMenuLayout,
        usersReducer,
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
    store.dispatch(ResponsiveDrawerLayout.REFRESH);
    store.dispatch(TopBottomMenuLayout.REFRESH);
    store.dispatch(BottomToolbarLayout.REFRESH);
    store.dispatch(ProgressView.HIDE);
};

