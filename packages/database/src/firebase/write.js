export default async function write(path, value, {} = {}) {
    const effectivePath = path instanceof Array ? path.join("/") : path;

    let ref = this._firebase.database().ref(effectivePath);
    const res = await ref.set(value);
    console.log(effectivePath, value, res);
    return;
}
