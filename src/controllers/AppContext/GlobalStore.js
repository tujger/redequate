export default class GlobalStore {
    constructor(initialValue = null) {
        this._initialValue = this._prepare(initialValue);
        this._value = this._initialValue;
        this._listeners = new Set();
    }

    _prepare(value) {
        return process.env.NODE_ENV !== "production"
            ? deepFreeze(value)
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

const deepFreeze = value => {
    const seen = new WeakSet();
    const objects = [];

    const visit = item => {
        if (typeof item === "function") {
            throw new TypeError("GlobalStore values must not contain functions");
        }
        if (item === null || typeof item !== "object" || seen.has(item)) return;

        const prototype = Object.getPrototypeOf(item);
        if (!Array.isArray(item) &&
            prototype !== Object.prototype &&
            prototype !== null) {
            throw new TypeError("GlobalStore values must contain only plain objects and arrays");
        }

        seen.add(item);
        objects.push(item);
        Reflect.ownKeys(item).forEach(key => {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (!Object.prototype.hasOwnProperty.call(descriptor, "value")) {
                throw new TypeError("GlobalStore values must not contain accessor properties");
            }
            visit(descriptor.value);
        });
    };

    visit(value);
    objects.forEach(Object.freeze);
    return value;
};
