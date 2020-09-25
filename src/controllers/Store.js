import ProgressView, {progressViewReducer} from "../components/ProgressView";
import {snackbarReducer} from "../components/Snackbar";
import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";
import {currentUserData} from "./UserData";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {chatsCounterReducer} from "../chat/ChatsCounter";
import {cacheDatas, Layout, MenuBadge} from "./General";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {auditReducer} from "../reducers/auditReducer";
import {errorsReducer} from "../reducers/errorsReducer";
import {usersReducer} from "../reducers/usersReducer";
import {dispatcherRoutedBodyReducer} from "../reducers/dispatcherRoutedBodyReducer";
import {mainAppbarReducer} from "../reducers/mainAppbarReducer";
import {topMenuReducer} from "../reducers/topMenuReducer";

const Store = (name, reducers) => {
    const initialStore = JSON.parse(window.localStorage.getItem(name));
    reducers = {
        audit: auditReducer,
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
    store.dispatch({type: LazyListComponent.RESET});
    store.dispatch({type: LazyListComponent.RESET, cache: "chats"});
    store.dispatch({type: MenuBadge.RESET});
    store.dispatch(ProgressView.HIDE);
};

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
