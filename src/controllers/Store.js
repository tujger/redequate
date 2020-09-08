import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";
import {currentUserData} from "./UserData";
import {cacheDatas, Layout, MenuBadge} from "./General";
import {lazyListReducer} from "../reducers/lazyListReducer";
import {chatsCounterReducer} from "../reducers/chatsCounterReducer";
import {mainAppbarReducer} from "../reducers/mainAppbarReducer";
import {topMenuReducer} from "../reducers/topMenuReducer";
import {errorsReducer} from "../reducers/errorsReducer";
import {usersReducer} from "../reducers/usersReducer";
import {snackbarReducer} from "../reducers/snackbarReducer";
import {progressViewReducer} from "../reducers/progressViewReducer";

const Store = (name, reducers) => {
    const initialStore = JSON.parse(window.localStorage.getItem(name));
    reducers = {
        chatsCounterReducer,
        currentUserData,
        dispatcherRoutedBodyReducer,
        errors: errorsReducer,
        lazyListReducer,
        mainAppbarReducer,
        progressView: progressViewReducer,
        snackbar: snackbarReducer,
        topMenuReducer,
        users: usersReducer,
        ...reducers
    };
    const store = createStore(combineReducers(reducers), initialStore || {});

    store.subscribe(() => {
        const saveable = {};
        for (let x in store.getState()) {
            if (reducers[x] && !reducers[x].skipStore) {
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
    cacheDatas.clear();
    store.dispatch({type: Layout.REFRESH});
    store.dispatch({type: lazyListReducer.RESET});
    store.dispatch({type: lazyListReducer.RESET, cache: "chats"});
    store.dispatch({type: MenuBadge.RESET});
    store.dispatch(progressViewReducer.HIDE);
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

// export const preferencesReducer = (state = {timestamp: 0}, action) => {
//     console.log(action)
//     switch (action.type) {
//         case preferencesReducer.LAST_VISIT.type:
//             console.log("UPDATE LAST VISIT");
//             return {...state, timestamp: new Date().getTime()};
//         default:
//             return state;
//     }
// };
// preferencesReducer.LAST_VISIT = {type: "_lastVisitTimestamp"};
