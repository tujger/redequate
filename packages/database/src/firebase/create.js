import {getDatabase, ref, push} from "firebase/database";
import {fail} from "../../../common";
import parsePath from "./helpers/parsePath";
import createRecord from "../common/methods/create";

export default async function create(firebase, path, value, run, backend) {
    return run(() => {
        const {parentAddress, key: suppliedKey} = parsePath(path, "create");
        const key = suppliedKey ?? (value instanceof Function
            ? push(ref(getDatabase(firebase.app), parentAddress)).key
            : undefined);
        return createRecord(backend, path, value, {key, mapError: mapCreateError});
    }, undefined, "create", {path, value});
}

const mapCreateError = error => {
    if (error.code === "functions/already-exists") {
        fail("database/conflict", "Record already exists.");
    }
    return error;
};
