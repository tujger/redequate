import {deepFreeze, registry} from "./_common";

class AppState {
    constructor(initialState = {}, shared = false) {
        this._stores = new Map();
        this._initialState = deepFreeze({...initialState});
        this._shared = shared;
    }

    store(key) {
        if (this._shared && typeof window === "undefined") {
            throw new Error(`SSR requires an explicit AppState for '${key}'`);
        }
        const registered = registry.get(key);
        if (!registered) {
            throw new Error(`Unknown global store '${key}'`);
        }
        if (this._shared) {
            return registered;
        }
        let store = this._stores.get(key);
        if (!store) {
            store = Object.prototype.hasOwnProperty.call(this._initialState, key)
                ? registered.fork(this._initialState[key])
                : registered.fork();
            this._stores.set(key, store);
        }
        return store;
    }
}

export const globalAppState = new AppState({}, true);

export const createAppState = initialState => new AppState(initialState);
