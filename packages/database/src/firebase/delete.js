import {resolvePath} from "./common";

export default async function deleteRecord(path, {} = {}) {
    const effectivePath = resolvePath(path);

    let ref = this.#firebase.database().ref(effectivePath);
    await ref.set(null);
    return;
}
