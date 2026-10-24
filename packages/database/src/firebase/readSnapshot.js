import {onValue} from "firebase/database";

export default query => new Promise((resolve, reject) => {
    onValue(query, resolve, reject, {onlyOnce: true});
});
