import {deepFreeze} from "./_common";

const identity = value => value;

export default class GlobalStore {
    constructor(initialValue, normalize = identity, prepared = false) {
        this._normalize = normalize;
        this._initialValue = prepared ? initialValue : this._prepare(initialValue === undefined ? null : initialValue);
        this._value = this._initialValue;
        this._listeners = new Set();
    }

    fork(initialValue) {
        return arguments.length
            ? new GlobalStore(initialValue, this._normalize)
            : new GlobalStore(this._initialValue, this._normalize, true);
    }

    _prepare(value) {
        const next = this._normalize(value);
        return deepFreeze(next);
    }

    get = () => this._value;

    getServerSnapshot = () => this._initialValue;

    subscribe = listener => {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    };

    set = update => {
        const next = this._prepare(typeof update === "function"
            ? update(this._value)
            : update);

        this._commit(next);
    };

    _commit(next) {
        if (Object.is(next, this._value)) return;

        this._value = next;
        for (const listener of Array.from(this._listeners)) {
            if (this._listeners.has(listener)) listener();
        }
    }

    reset = () => this._commit(this._initialValue);
}
