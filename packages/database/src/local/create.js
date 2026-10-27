import {key as generateKey} from "firebase-key";
import parseCreatePath from "../common/parseCreatePath";

export default async function createRecord(path, value, run, superCreate) {
    return run(() => {
        const key = parseCreatePath(path).key ?? generateKey();
        return superCreate(path, value, {key});
    }, undefined, "create", {path, value});
}
