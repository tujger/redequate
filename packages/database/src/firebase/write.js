import {resolvePath} from "./common";

export default async function write(path, value, {} = {}) {
    const effectivePath = resolvePath(path);

    let ref = this._firebase.database().ref(effectivePath);
    await ref.set(value);
}
