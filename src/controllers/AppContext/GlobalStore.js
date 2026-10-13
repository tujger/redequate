const identity = value => value;

export default class GlobalStore {
    constructor(initialValue = null, normalize = identity) {
        this._normalize = normalize;
        this._initialValue = this._prepare(initialValue);
        this._value = this._initialValue;
        this._listeners = new Set();
    }

    fork(initialValue = this._initialValue) {
        return new GlobalStore(initialValue, this._normalize);
    }

    _prepare(value) {
        const next = this._normalize(value);
        return process.env.NODE_ENV !== "production" ? deepFreeze(next) : next;
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

        if (Object.is(next, this._value)) return;

        this._value = next;
        this._listeners.forEach(listener => listener());
    };

    reset = () => this.set(this._initialValue);
}

const deepFreeze = value => {
    const seen = new WeakSet();
    const objects = [];

    const visit = item => {
        if (item === null || typeof item !== "object" || seen.has(item)) return;

        seen.add(item);
        objects.push(item);
        Reflect.ownKeys(item).forEach(key => {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (Object.prototype.hasOwnProperty.call(descriptor, "value")) visit(descriptor.value);
        });
    };

    visit(value);
    objects.forEach(Object.freeze);
    return value;
};
