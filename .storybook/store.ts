import {useDispatch} from "react-redux"
import {combineReducers, createStore} from "redux";
import {progressViewReducer} from "../src/components/ProgressView";

const store = createStore(combineReducers({
    // alertsCounter: alertsCounterReducer,
    // alertsVisit: alertsVisitReducer,
    // audit: auditReducer,
    // chatsCounter: chatsCounterReducer,
    // confirmComponentReducer,
    // currentUserData,
    // dispatcherRoutedBodyReducer,
    // language: languageReducer,
    // lazyListComponentReducer,
    // mainAppbarReducer,
    // refreshOnVisibilityReducer,
    // newPostComponentReducer,
    progressView: progressViewReducer,
    // snackbar: snackbarReducer,
    // tags: tagsReducer,
    // topMenuReducer,
    // users: usersReducer,
}), {})

export { store }

export type AppDispatch = typeof store.dispatch
export const useAppDispatch = () => useDispatch<AppDispatch>()
