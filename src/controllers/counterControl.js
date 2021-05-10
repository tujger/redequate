import {firebaseMessaging} from "./Firebase";

export default (
    {
        path,
        increase,
        increment,
        decrease,
        onchange,
        value
    }) => {
    if (!path) {
        throw Error("Path is not defined");
    }
    if (path instanceof Array) {
        path = path.join("/");
    }
    if (onchange) {
        const counterRef = firebaseMessaging.database().ref("_counters").child(path);
        const listener = snapshot => {
            onchange(snapshot.val());
        }
        counterRef.on("value", listener);
        return () => {
            counterRef.off("value", listener);
        }
    } else if (increase !== undefined || increment !== undefined || decrease !== undefined || value !== undefined) {

        return firebaseMessaging.database().ref("_counters").child(path)
            .transaction(initial => {
                if (!initial) {
                    if (increase) return increase;
                    else if (increment) return increment;
                    else if (value) return value;
                    else return null;
                } else if (initial <= 0) {
                    if (increase > 0) return increase;
                    else if (increment) return increment;
                    else if (value) return value;
                    else return null;
                } else {
                    let result = initial;
                    if (increase > 0) result += increase;
                    else if (increment) result += increment;
                    else if (decrease > 0) result -= decrease;
                    else if (value) result = value;

                    if (result <= 0) result = null;
                    return result;
                }
            })
    } else {
        const counterRef = firebaseMessaging.database().ref("_counters").child(path);
        return counterRef.once("value", snapshot => {
            return snapshot.val();
        });
    }
}
