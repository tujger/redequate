import {vi} from "vitest";

// Controlled SDK responses; query semantics are verified against the emulator.
export function createFirebase() {
    const listeners = [];
    const sdk = {
        refs: [], listeners,
        once: vi.fn(),
        set: vi.fn().mockResolvedValue(),
        update: vi.fn().mockResolvedValue(),
        transaction: vi.fn().mockResolvedValue({committed: true}),
        on: vi.fn(), off: vi.fn(),
    };
    let sequence = 0;
    function reference(path = "", query = {}) {
        const ref = {path, query, key: path.split("/").at(-1)};
        for (const method of ["orderByKey", "orderByValue", "orderByChild", "equalTo", "startAt", "endAt", "limitToFirst", "limitToLast"]) {
            ref[method] = vi.fn((...args) => reference(path, {...query, [method]: args}));
        }
        ref.once = vi.fn((...args) => sdk.once(ref, ...args));
        ref.set = vi.fn(value => sdk.set(ref, value));
        ref.update = vi.fn(value => sdk.update(ref, value));
        ref.transaction = vi.fn((...args) => sdk.transaction(ref, ...args));
        ref.push = vi.fn(() => reference(`${path}/generated-${++sequence}`));
        ref.on = vi.fn((type, callback, onError) => {
            sdk.on(ref, type, callback, onError);
            listeners.push({ref, type, callback, onError});
        });
        ref.off = vi.fn((type, callback) => {
            sdk.off(ref, type, callback);
            const index = listeners.findIndex(listener => listener.ref === ref && listener.type === type && listener.callback === callback);
            if (index >= 0) listeners.splice(index, 1);
        });
        sdk.refs.push(ref);
        return ref;
    }
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
    const database = () => ({ref: vi.fn(reference)});
    database.ServerValue = {TIMESTAMP: {".sv": "timestamp"}, increment: vi.fn(delta => ({".sv": {increment: delta}}))};
    return {
        firebase: {database}, sdk, snapshot,
        emit(type, value, key = "new") {
            for (const listener of [...listeners]) {
                if (listener.type === type) listener.callback(snapshot(value, key));
            }
        },
    };
}
