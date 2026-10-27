import {vi} from "vitest";


export const firebaseDatabaseMock = () => {
    const subscribe = (type, ref, callback, onError) => {
        const {sdk} = ref.database;
        sdk.on(ref, type, callback, onError);
        const listener = {ref, type, callback, onError};
        sdk.listeners.push(listener);
        return () => {
            sdk.off(ref, type, callback);
            const index = sdk.listeners.indexOf(listener);
            if (index >= 0) sdk.listeners.splice(index, 1);
        };
    };
    const constraints = Object.fromEntries([
        "orderByKey", "orderByValue", "orderByChild", "equalTo", "startAt", "endAt", "limitToFirst", "limitToLast"
    ].map(name => [name, (...args) => ({[name]: args})]));
    return {
        ...constraints,
        getDatabase: app => app.database,
        ref: (database, path) => database.reference(path),
        query: (ref, ...constraints) => ref.database.reference(ref.path, Object.assign({}, ref.query, ...constraints)),
        push: ref => ref.database.push(ref),
        set: (ref, value) => ref.database.sdk.set(ref, value),
        update: (ref, value) => ref.database.sdk.update(ref, value),
        runTransaction: (ref, callback, options) => ref.database.sdk.transaction(ref, callback, options),
        onValue: (ref, callback, onError, options) => {
            if (options?.onlyOnce) {
                ref.database.sdk.once(ref, "value").then(callback, onError);
                return () => {};
            }
            return subscribe("value", ref, callback, onError);
        },
        onChildAdded: (...args) => subscribe("child_added", ...args),
        onChildChanged: (...args) => subscribe("child_changed", ...args),
        onChildRemoved: (...args) => subscribe("child_removed", ...args),
        serverTimestamp: () => ({".sv": "timestamp"}),
        increment: delta => ({".sv": {increment: delta}}),
    };
};

// Controlled SDK responses; query semantics are verified against the emulator.
export function createFirebase() {
    const listeners = [];
    const sdk = {
        refs: [], listeners,
        once: vi.fn(),
        set: vi.fn().mockResolvedValue(),
        update: vi.fn().mockResolvedValue(),
        transaction: vi.fn(),
        on: vi.fn(), off: vi.fn(),
    };
    let sequence = 0;
    const database = {sdk, reference};
    function reference(path = "", query = {}) {
        const ref = {database, path, query, key: path.split("/").at(-1)};
        sdk.refs.push(ref);
        return ref;
    }
    database.push = ref => reference(`${ref.path}/generated-${++sequence}`);
    function snapshot(value, key, path = "records") {
        return {
            key,
            val: () => structuredClone(value),
            exists: () => value !== null && value !== undefined,
            ref: reference(`${path}/${key}`),
            child: field => snapshot(field.split("/").reduce((item, part) => item?.[part], value), key, path),
            forEach: callback => {
                for (const [childKey, childValue] of Object.entries(value ?? {})) {
                    if (callback(snapshot(childValue, childKey, path)) === true) break;
                }
            },
        };
    }
    // Assign the default after reference is initialized.
    sdk.once.mockResolvedValue({exists: () => false, val: () => null, forEach: () => {}});
    return {
        firebase: {app: {database}}, sdk, snapshot,
        emit(type, value, key = "new") {
            for (const listener of [...listeners]) {
                if (listener.type === type) listener.callback(snapshot(value, key));
            }
        },
    };
}
