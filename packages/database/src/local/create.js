import {key as generateKey} from "firebase-key";
import parsePath from "./parsePath";

export default async function createRecord(path, value, run, superCreate) {
    return run(() => {
        const key = parsePath(path, "create").key ?? generateKey();
        return superCreate(path, value, {key});
    }, undefined, "create", {path, value});
}
