import ProgressView, {progressViewReducer} from "../components/ProgressView";
import {snackbarReducer} from "../components/Snackbar";
import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";
import {currentUserData} from "./UserData";
import {usersReducer} from "../pages/admin/Users";
import LazyListComponent, {lazyListComponentReducer} from "../components/LazyListComponent";
import {topMenuReducer} from "../components/TopMenu";
import {chatsCounterReducer} from "../chat/ChatsCounter";
import {errorsReducer} from "../pages/admin/Errors";
import {mainAppbarReducer} from "../components/MainAppbar";
import {Layout, MenuBadge} from "./General";

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
    console.warn("[Store] refresh");
    store.dispatch({type: Layout.REFRESH});
    store.dispatch({type: LazyListComponent.RESET});
    store.dispatch({type: LazyListComponent.RESET, cache: "chats"});
    store.dispatch({type: MenuBadge.RESET});
    store.dispatch(ProgressView.HIDE);
};

// moved here from ../Dispatcher.js due to circular dependencies alert
export const dispatcherRoutedBodyReducer = (state = {random: 0}, action) => {
    switch (action.type) {
        case Layout.REFRESH:
            return {...state, random: Math.random()};
        default:
            return state;
    }
};
dispatcherRoutedBodyReducer.skipStore = true;

