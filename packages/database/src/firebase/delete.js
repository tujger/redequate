import resolvePath from "../common/resolvePath";

export default function deleteRecord(firebase, path) {
    return firebase.database().ref(resolvePath(path)).set(null);
}
