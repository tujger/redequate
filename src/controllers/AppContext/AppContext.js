import {
    createContext,
    createElement,
    useState
} from "react";

import GlobalStore from "./GlobalStore";

const registry = new Map();

if (typeof window !== "undefined") {
    window.redequate = window.redequate || {};
    window.redequate.cache = () => Object.fromEntries(
        Array.from(registry, ([key, store]) => [key, store.get()])
    );
}

export function registerStore(key, initialValue = null) {
    if (registry.has(key)) {
        throw new Error(`Global store '${key}' already registered`);
    }

    const store = new GlobalStore(initialValue);
    registry.set(key, store);

    return store;
}

class AppState {
    constructor(initialState = {}, shared = false) {
        this._stores = new Map();
        this._initialState = initialState;
        this._shared = shared;
    }

    store(key) {
        const registered = registry.get(key);

        if (!registered) {
            throw new Error(`Unknown global store '${key}'`);
        }

        if (this._shared) {
            return registered;
        }

        let store = this._stores.get(key);

        if (!store) {
            const initialValue =
                Object.prototype.hasOwnProperty.call(
                    this._initialState, key
                )
                    ? this._initialState[key]
                    : registered.getServerSnapshot();

            store = new GlobalStore(initialValue);
            this._stores.set(key, store);
        }

        return store;
    }
}

export const _AppContext = createContext(null);

export const globalAppState = new AppState({}, true);

export const createAppState = initialState =>
    new AppState(initialState);

export default function AppContext(
    {
        value,
        initialState,
        children
    }) {
    const [state] = useState(() =>
        typeof window === "undefined"
            ? createAppState(initialState)
            : initialState
                ? createAppState(initialState)
                : globalAppState
    );

    return createElement(
        _AppContext.Provider,
        {
            value: {
                ...value,
                state
            }
        },
        children
    );
}
