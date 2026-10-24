import {getDatabase, ref, set} from "firebase/database";
import resolvePath from "../common/resolvePath";

export default function deleteRecord(firebase, path) {
    return set(ref(getDatabase(firebase.app), resolvePath(path)), null);
}
