import {fail} from "../../../common";
import resolvePath from "./resolvePath";

/**
 * Listen for value and child events, returning an independent remove handle.
 * Child additions track limitToLast(1), ordered by orderBy or by key.
 * Additions include existing children entering that query's result.
 * Child changes and removals track the entire collection.
 * Optional handlers must be functions or undefined.
 */
export default function addEventListener(firebase, path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderBy}) {
    for (const [name, handler] of Object.entries({onChange, onChildAdd, onChildChange, onChildRemove, onError})) {
        if (handler !== undefined && !(handler instanceof Function)) {
            fail("database/invalid-argument", `${name} must be a function or undefined.`);
        }
    }
    const effectivePath = resolvePath(path);
    orderBy = orderBy === undefined ? undefined : resolvePath(orderBy);

    const ref = firebase.database().ref(effectivePath);

    let refChildAdd, refChildRemove;

    const valueListener = notifyValue.bind(null, onChange);
    const childAddListener = notifyEntry.bind(null, onChildAdd);
    const childChangeListener = notifyEntry.bind(null, onChildChange);
    const childRemoveListener = notifyEntry.bind(null, onChildRemove);

    const remove = () => {
        refChildAdd?.off("child_added", childAddListener);
        refChildRemove?.off("child_removed", childRemoveListener);
        if (onChange) ref.off("value", valueListener);
        if (onChildChange) ref.off("child_changed", childChangeListener);
    };

    try {
        if (onChange) {
            ref.on("value", valueListener, onError);
        }
        if (onChildAdd) {
            const query = orderBy === undefined ? ref.orderByKey()
                : orderBy === "" ? ref.orderByValue() : ref.orderByChild(orderBy);
            refChildAdd = query.limitToLast(1);
            refChildAdd.on("child_added", childAddListener, onError);
        }
        if (onChildChange) {
            ref.on("child_changed", childChangeListener, onError);
        }
        if (onChildRemove) {
            refChildRemove = ref.orderByKey();
            refChildRemove.on("child_removed", childRemoveListener, onError);
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
