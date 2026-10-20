import resolvePath from "./resolvePath";

export default async function read(firebase, path, {equalTo, orderBy} = {}) {
    const effectivePath = resolvePath(path);
    orderBy = orderBy === undefined ? undefined : resolvePath(orderBy);

    let ref = firebase.database().ref(effectivePath);
    if(orderBy !== undefined) {
        ref = orderBy === "" ? ref.orderByValue() : ref.orderByChild(orderBy);
    }
    if(equalTo !== undefined) {
        ref = ref.equalTo(equalTo);
    } else if(orderBy !== undefined) {
        ref = ref.limitToLast(1);
    }
    const snapshot = await ref.once("value");
    if (snapshot.exists()) {
        return snapshot.val();
    } else {
        return undefined;
    }
}
