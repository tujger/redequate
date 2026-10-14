import {resolvePath} from "./common";

export default async function read(firebase, path, {equalTo, orderBy} = {}) {
    const effectivePath = resolvePath(path);

    let ref = firebase.database().ref(effectivePath);
    if(orderBy) {
        ref = ref.orderByChild(orderBy);
    }
    if(equalTo) {
        ref = ref.equalTo(equalTo);
    } else if(orderBy) {
        ref = ref.limitToLast(1);
    }
    const snapshot = await ref.once("value");
    if (snapshot.exists()) {
        return snapshot.val();
    } else {
        return undefined;
    }
}
