export default async function update(path, changes, {} = {}) {
    if (changes === undefined) {
        const result = {};
        for (const p in path) {
            result[p] = await upd.call(this, p, path[p]);
        }
        return result;
    } else {
        return upd.call(this, path, changes);
    }
}

function upd(path, changes) {
    const effectivePath = path instanceof Array ? path.join("/") : path;
    let ref = this._firebase.database().ref(effectivePath);
    return ref.update(changes);
}
