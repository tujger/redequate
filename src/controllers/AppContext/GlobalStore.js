
export default class GlobalStore {
    constructor(initialValue = null) {
        this._initialValue = this._prepare(initialValue);
        this._value = this._initialValue;
        this._listeners = new Set();
    }

    _prepare(value) {
        return process.env.NODE_ENV !== "production"
            ? freeze(value)
            : value;
    }

    get = () => this._value;

    getServerSnapshot = () => this._initialValue;

    subscribe = listener => {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    };

    set = update => {
        const next = typeof update === "function"
            ? update(this._value)
            : update;

        if (Object.is(next, this._value)) return;

        this._value = this._prepare(next);
        this._listeners.forEach(listener => listener());
    };

    reset = () => this.set(this._initialValue);
}

const freeze = (value, seen = new WeakSet()) => {
    if (value === null || typeof value !== "object" || seen.has(value)) {
        return value;
    }

    const prototype = Object.getPrototypeOf(value);

    if (!Array.isArray(value) &&
        prototype !== Object.prototype &&
        prototype !== null) {
        return value;
    }

    seen.add(value);

    Reflect.ownKeys(value).forEach(key => freeze(value[key], seen));

    return Object.freeze(value);
};
