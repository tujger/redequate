export default async function read(path, {equalTo, orderBy} = {}) {
    const effectivePath = path instanceof Array ? path.join("/") : path;

    let ref = this._firebase.database().ref(effectivePath);
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
