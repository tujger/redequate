import DatabaseBase from "../DatabaseBase";

export default class FirebaseDatabase extends DatabaseBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

    addEventListener(path, {onChange, onChildAdd, onChildChange, onChildRemove, onError, orderByChild}) {
        const effectivePath = path instanceof Array ? path.join("/") : path;

        const ref = this._firebase.database().ref(effectivePath);
        let refChildAdd, refChildRemove;

        if (onChange) {
            ref.on("value", snapshot => {
                const value = snapshot.val();
                // console.log(effectivePath, "onChange", snapshot.key, value)
                onChange(value);
            }, onError);
        }
        if (onChildAdd) {
            if(orderByChild) {
                refChildAdd = ref.orderByChild(orderByChild).limitToLast(1);
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

    async read(path, {orderByChild = undefined} = {}) {
        const effectivePath = path instanceof Array ? path.join("/") : path;

        let ref = this._firebase.database().ref(effectivePath);
        if(orderByChild) {
            ref = ref.orderByChild(orderByChild).limitToLast(1);
        }
        const snapshot = await ref.once("value");
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            return undefined;
        }
    }
}
