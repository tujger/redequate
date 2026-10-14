import React from "react";
import {_AppContext, registry} from "./_common";
import {createAppState, globalAppState} from "./AppState";

if (typeof window !== "undefined") {
    window.redequate = window.redequate || {};
    window.redequate.cache = () => Object.fromEntries(
        Array.from(registry, ([key, store]) => [key, store.get()])
    );
}

export default function AppContext(
    {
        value,
        state: providedState,
        initialState,
        children
    }) {
    // State and hydration seeds are chosen once for this provider mount.
    const [state] = React.useState(() => {
        if (providedState !== undefined) {
            return providedState;
        }
        if (typeof window === "undefined") {
            return createAppState(initialState)
        }
        if (initialState) {
            return createAppState(initialState)
        }
        return globalAppState
    });
    const context = React.useMemo(() => ({...value, state}), [value, state]);

    return <_AppContext value={context}>
        {children}
    </_AppContext>
}
