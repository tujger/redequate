import {
    useContext,
    useSyncExternalStore
} from "react";

import {
    _AppContext,
    registerStore,
    globalAppState
} from "./AppContext";

export default class UseAbstract {
    constructor(key, initialValue = null) {
        this._key = key;
        this._store = registerStore(key, initialValue);
    }

    useInstance() {
        const context = useContext(_AppContext);

        if (typeof window === "undefined" && !context?.state) {
            throw new Error(
                `SSR requires AppContext for '${this._key}'`
            );
        }

        return context?.state
            ? context.state.store(this._key)
            : this._store;
    }

    useValue() {
        const store = this.useInstance();

        return useSyncExternalStore(
            store.subscribe,
            store.get,
            store.getServerSnapshot
        );
    }

    useSet() {
        return this.useInstance().set;
    }

    useStore() {
        const store = this.useInstance();
        const value = useSyncExternalStore(
            store.subscribe,
            store.get,
            store.getServerSnapshot
        );

        return [value, store.set];
    }

    get(state = globalAppState) {
        return state.store(this._key).get();
    }

    set(value, state = globalAppState) {
        state.store(this._key).set(value);
    }

    reset(state = globalAppState) {
        state.store(this._key).reset();
    }
}
