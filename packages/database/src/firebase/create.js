import {getDatabase, ref, push} from "firebase/database";
import {fail} from "../../../common";
import parsePath from "./parsePath";

const mapCreateError = error => {
    if (error.code === "functions/already-exists") {
        fail("database/conflict", "Record already exists.");
    }
    return error;
};

export default async function createRecord(firebase, path, value, run, superCreate) {
    return run(() => {
        const {parentAddress, key: suppliedKey} = parsePath(path, "create");
        const key = suppliedKey ?? (value instanceof Function
            ? push(ref(getDatabase(firebase.app), parentAddress)).key
            : undefined);
        return superCreate(path, value, {key, mapError: mapCreateError});
    }, undefined, "create", {path, value});
}
