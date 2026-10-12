export default async function deleteRecord(path, {} = {}) {
    const effectivePath = path instanceof Array ? path.join("/") : path;

    let ref = this._firebase.database().ref(effectivePath);
    await ref.set(null);
    return;
}
