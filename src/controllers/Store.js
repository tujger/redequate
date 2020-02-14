import {progressView} from "../components/ProgressView";
import {responsiveDrawer} from "../layouts/ResponsiveDrawer";
import {topBottomMenuLayout} from "../layouts/TopBottomMenuLayout";
import {snackbar} from "../components/Snackbar";
import {editProfile} from "../pages/EditProfile";
import {combineReducers, createStore} from "redux";
import PropTypes from "prop-types";

const Store = (name, reducers) => {
    const initialStore = JSON.parse(window.localStorage.getItem(name));
    const store = createStore(combineReducers({
        editProfile,
        progressView,
        responsiveDrawer,
        snackbar,
        topBottomMenuLayout,
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
