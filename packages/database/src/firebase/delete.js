import resolvePath from "./resolvePath";

export default async function deleteRecord(firebase, path, {} = {}) {
    const effectivePath = resolvePath(path);

    let ref = firebase.database().ref(effectivePath);
    await ref.set(null);
    return;
}
