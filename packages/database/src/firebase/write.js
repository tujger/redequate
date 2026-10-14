import {resolvePath} from "./common";

export default async function write(firebase, path, value, {} = {}) {
    const effectivePath = resolvePath(path);

    let ref = firebase.database().ref(effectivePath);
    await ref.set(value);
}
