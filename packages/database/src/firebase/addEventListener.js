import {fail} from "../../../common";
import {resolvePath} from "./common";

/**
 * Listen for value and child events, returning an independent remove handle.
 * Child additions track limitToLast(1), ordered by orderBy or by key.
 * Additions include existing children entering that query's result.
 * Child changes and removals track the entire collection.
 * Optional handlers must be functions or undefined.
 */
export default function addEventListener(firebase, path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderBy}) {
    for (const [name, handler] of Object.entries({onChange, onChildAdd, onChildChange, onChildRemove, onError})) {
        if (handler !== undefined && typeof handler !== "function") {
            fail("database/invalid-argument", `${name} must be a function or undefined.`);
        }
    }
    const effectivePath = resolvePath(path);

    const ref = firebase.database().ref(effectivePath);

    let refChildAdd, refChildRemove;

    const valueListener = snapshot => {
        if(snapshot.exists()) {
            const value = snapshot.val();
            // console.log(effectivePath, "onChange", snapshot.key, value)
            onChange(value);
        } else {
            onChange(undefined);
        }
    }

    const childAddListener = snapshot => {
        const key = snapshot.key;
        const value = snapshot.val();
        // console.log(effectivePath, "onChildAdd", key, value)
        onChildAdd({key, value});
    }

    const childChangeListener = snapshot => {
        const key = snapshot.key;
        const value = snapshot.val();
        // console.log(effectivePath, "onChildChange", key, value)
        onChildChange({key, value});
    }

    const childRemoveListener = snapshot => {
        const key = snapshot.key
        const value = snapshot.val();
        // console.log(effectivePath, "onChildRemove", key, value)
        onChildRemove({key, value});
    }

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
            refChildAdd = orderBy ? ref.orderByChild(orderBy).limitToLast(1) : ref.orderByKey().limitToLast(1);
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
