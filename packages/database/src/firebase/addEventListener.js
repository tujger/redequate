import {getDatabase, ref, query, orderByKey, onValue, onChildAdded, onChildChanged, onChildRemoved} from "firebase/database";
import {fail} from "../../../common";
import resolvePath from "../common/resolvePath";
import parseReadPath from "../common/parseReadPath";
import compareKeys from "../common/compareKeys";

/**
 * Listen for value and child events, returning an independent remove handle.
 * Child additions include only keys greater than the maximum key in the
 * first collection snapshot. The value listener is registered first; child
 * events received before its first callback are buffered. A write already
 * included in that snapshot is part of the baseline, even if it happened
 * after this function was called. This is not a gap-free call-time boundary.
 * Child changes and removals track the entire collection.
 * Optional handlers must be functions or undefined.
 */
export default function addEventListener(firebase, path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderBy}) {
    for (const [name, handler] of Object.entries({onChange, onChildAdd, onChildChange, onChildRemove, onError})) {
        if (handler !== undefined && !(handler instanceof Function)) {
            fail("database/invalid-argument", `${name} must be a function or undefined.`);
        }
    }
    const listenerPath = Array.isArray(path) && path.length ? parseReadPath(path).path : path;
    const effectivePath = resolvePath(listenerPath);
    orderBy = orderBy === undefined ? undefined : resolvePath(orderBy);

    const reference = ref(getDatabase(firebase.app), effectivePath);

    let initialKey, initialized = !onChildAdd, active = true;
    const unsubscribers = [];
    const pending = [];

    const valueListener = snapshot => {
        if (!active) return;
        if (!initialized) {
            snapshot.forEach(child => {
                if (initialKey === undefined || compareKeys(child.key, initialKey) > 0) initialKey = child.key;
            });
            initialized = true;
            for (const child of pending.splice(0)) childAddListener(child);
        }
        if (onChange) notifyValue(onChange, snapshot);
    };
    const childAddListener = snapshot => {
        if (!active) return;
        if (!initialized) { pending.push(snapshot); return; }
        if (initialKey === undefined || compareKeys(snapshot.key, initialKey) > 0) {
            notifyEntry(onChildAdd, snapshot);
        }
    };
    const childChangeListener = notifyEntry.bind(null, onChildChange);
    const childRemoveListener = notifyEntry.bind(null, onChildRemove);

    const remove = () => {
        active = false;
        pending.length = 0;
        for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
    };
    const cancel = error => { remove();onError?.(error); };

    try {
        if (onChange || onChildAdd) {
            unsubscribers.push(onValue(reference, valueListener, cancel));
        }
        if (onChildAdd) {
            unsubscribers.push(onChildAdded(query(reference, orderByKey()), childAddListener, cancel));
        }
        if (onChildChange) {
            unsubscribers.push(onChildChanged(reference, childChangeListener, cancel));
        }
        if (onChildRemove) {
            unsubscribers.push(onChildRemoved(query(reference, orderByKey()), childRemoveListener, cancel));
        }
    } catch (error) {
        remove();
        throw error;
    }

    return {remove};
}

function notifyValue(handler, snapshot) {
    handler(snapshot.exists() ? snapshot.val() : undefined);
}

function notifyEntry(handler, snapshot) {
    handler({key: snapshot.key, value: snapshot.val()});
}
