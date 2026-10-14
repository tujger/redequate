import {resolvePath} from "./common";

export default function addEventListener(firebase, path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderBy}) {
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

    if (onChange) {
        ref.on("value", valueListener, onError);
    }
    if (onChildAdd) {
        if(orderBy) {
            refChildAdd = ref.orderByChild(orderBy).limitToLast(1);
        } else {
            refChildAdd = ref.orderByKey().limitToLast(1);
        }
        refChildAdd.on("child_added", childAddListener, onError);
    }
    if (onChildChange) {
        ref.on("child_changed", childChangeListener, onError);
    }
    if (onChildRemove) {
        refChildRemove = ref.orderByKey();
        refChildRemove.on("child_removed", childRemoveListener, onError);
    }

    return {
        remove() {
            refChildAdd?.off("child_added", childAddListener);
            refChildRemove?.off("child_removed", childRemoveListener);
            if (onChange) ref.off("value", valueListener);
            if (onChildChange) ref.off("child_changed", childChangeListener);
        }
    }
}
