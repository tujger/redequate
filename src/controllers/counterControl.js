import {firebaseMessaging} from "./Firebase";

export default (
    {
        database,
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
    path = path instanceof Array ? path : [path];
    if (onchange) {
        // UNKNOWN: callers supply either a post key or a composite counter address.
        const listener = database.addEventListener(["_counters", ...path], {
            onChange(value) {
                onchange(value);
            }
        });
        return () => {
            listener.remove();
        }
    } else if (increase !== undefined || increment !== undefined || decrease !== undefined || value !== undefined) {
        return database.update(["_counters", ...path], initial => {
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
        });
        // return firebaseMessaging.database().ref("_counters").child(path)
        //     .transaction(initial => {
        //     })
    } else {
        return database.read(["_counters", ...path]);
    }
}
