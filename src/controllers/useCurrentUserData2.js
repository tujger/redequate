import {useSyncExternalStore} from "react";
import {createStore} from "redux";

const SET_VALUE = "redequate-currentUserData/set";
const initialValue = "";

const store = createStore((state = initialValue, action) => {
    if (action.type === SET_VALUE) return action.payload;
    return state;
});

const setCurrentUserData = value => {
    const nextValue = typeof value === "function"
        ? value(store.getState())
        : value;
    store.dispatch({type: SET_VALUE, payload: nextValue});
};

export function useCurrentUserData() {
    return [useCurrentUserDataValue(), useSetCurrentUserData()];
}

export function useCurrentUserDataValue() {
    return useSyncExternalStore(
        store.subscribe,
        store.getState,
        () => initialValue
    );
}

export function useSetCurrentUserData() {
    return setCurrentUserData;
}

export function getCurrentUserData() {
    return store.getState();
}
