import ProgressView, {progressView} from "../components/ProgressView";
import ResponsiveDrawerLayout, {responsiveDrawerLayout} from "../layouts/ResponsiveDrawerLayout";
import TopBottomMenuLayout, {topBottomMenuLayout} from "../layouts/TopBottomMenuLayout";
import TopBottomToolbarLayout, {topBottomToolbarLayout} from "../layouts/TopBottomToolbarLayout";
import {snackbar} from "../components/Snackbar";
import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";

const Store = (name, reducers) => {
    const initialStore = JSON.parse(window.localStorage.getItem(name));
    const store = createStore(combineReducers({
        progressView,
        responsiveDrawerLayout,
        snackbar,
        topBottomMenuLayout,
      topBottomToolbarLayout,
        ...(reducers ? reducers : {})
    }), initialStore || {});

    store.subscribe(state => {
        window.localStorage.setItem(name, JSON.stringify(store.getState()));
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
  store.dispatch(TopBottomToolbarLayout.REFRESH);
  store.dispatch(ProgressView.HIDE);
};

