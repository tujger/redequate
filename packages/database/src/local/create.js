import {key as generateKey} from "firebase-key";
import parsePath from "./helpers/parsePath";
import createRecord from "../common/methods/create";

export default async function create(path, value, run, backend) {
    return run(() => {
        const key = parsePath(path, "create").key ?? generateKey();
        return createRecord(backend, path, value, {key});
    }, undefined, "create", {path, value});
}
