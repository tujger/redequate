import ProgressView, {progressViewReducer} from "../components/ProgressView";
import {snackbarReducer} from "../components/Snackbar";
import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";
import {currentUserData} from "./UserData";
import {cacheDatas, Layout, MenuBadge} from "./General";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {auditReducer} from "../reducers/auditReducer";
import {errorsReducer} from "../reducers/errorsReducer";
import {usersReducer} from "../pages/admin/users/usersReducer";
import {dispatcherRoutedBodyReducer} from "../reducers/dispatcherRoutedBodyReducer";
import {mainAppbarReducer} from "../layouts/ResponsiveDrawerLayout/mainAppbarReducer";
import {topMenuReducer} from "../layouts/TopBottomMenuLayout/topMenuReducer";
import {chatsCounterReducer} from "../chat/chatsCounterReducer";
import {alertsVisitReducer} from "../alerts/alertsVisitReducer";
import {alertsCounterReducer} from "../alerts/alertsCounterReducer";
import {newPostComponentReducer} from "../components/NewPostComponent/newPostComponentReducer";

const Store = (name, reducers) => {
    const initialStore = JSON.parse(window.localStorage.getItem(name));
    reducers = {
        alertsCounter: alertsCounterReducer,
        alertsVisit: alertsVisitReducer,
        audit: auditReducer,
        chatsCounter: chatsCounterReducer,
        currentUserData,
        dispatcherRoutedBodyReducer,
        errors: errorsReducer,
        lazyListComponentReducer,
        mainAppbarReducer,
        newPostComponentReducer,
        progressView: progressViewReducer,
        snackbar: snackbarReducer,
        topMenuReducer,
        users: usersReducer,
        ...reducers
    };
    const store = createStore(combineReducers(reducers), initialStore || {});

    store.subscribe(() => {
        const saveable = {};
        for (const x in store.getState()) {
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
    console.warn("[Store] refresh all");
    cacheDatas.clear();
    store.dispatch({type: Layout.REFRESH});
    store.dispatch({type: lazyListComponentReducer.RESET});
    store.dispatch({type: lazyListComponentReducer.RESET, cache: "chats"});
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
