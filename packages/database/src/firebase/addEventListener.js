import {resolvePath} from "./common";

export default function addEventListener(path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderBy}) {
    const effectivePath = resolvePath(path);

    const ref = this._firebase.database().ref(effectivePath);
    let refChildAdd, refChildRemove;

    if (onChange) {
        ref.on("value", snapshot => {
            if(snapshot.exists()) {
                const value = snapshot.val();
                // console.log(effectivePath, "onChange", snapshot.key, value)
                onChange(value);
            } else {
                onChange(undefined);
            }
        }, onError);
    }
    if (onChildAdd) {
        if(orderBy) {
            refChildAdd = ref.orderByChild(orderBy).limitToLast(1);
        } else {
            refChildAdd = ref.orderByKey().limitToLast(1);
        }
        refChildAdd.on("child_added", snapshot => {
            const key = snapshot.key;
            const value = snapshot.val();
            // console.log(effectivePath, "onChildAdd", key, value)
            onChildAdd({key, value});
        }, onError);
    }
    if (onChildChange) {
        ref.on("child_changed", snapshot => {
            const key = snapshot.key;
            const value = snapshot.val();
            // console.log(effectivePath, "onChildChange", key, value)
            onChildChange({key, value});
        }, onError);
    }
    if (onChildRemove) {
        refChildRemove = ref.orderByKey();
        refChildRemove.on("child_removed", snapshot => {
            const key = snapshot.key
            const value = snapshot.val();
            // console.log(effectivePath, "onChildRemove", key, value)
            onChildRemove({key, value});
        }, onError);
    }

    return {
        remove() {
            refChildAdd?.off();
            refChildRemove?.off();
            ref.off()
        }
    }
}
