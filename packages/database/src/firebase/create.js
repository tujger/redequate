import {getDatabase, ref, push} from "firebase/database";
import {fail} from "../../../common";
import parseCreatePath from "../common/parseCreatePath";
import resolvePath from "../common/resolvePath";

const mapCreateError = error => {
    if (error.code === "functions/already-exists") {
        fail("database/conflict", "Record already exists.");
    }
    return error;
};

export default async function createRecord(firebase, path, value, run, superCreate) {
    return run(() => {
        const {parentPath, key: suppliedKey} = parseCreatePath(path);
        const key = suppliedKey ?? (value instanceof Function
            ? push(ref(getDatabase(firebase.app), resolvePath(parentPath))).key
            : undefined);
        return superCreate(path, value, {key, mapError: mapCreateError});
    }, undefined, "create", {path, value});
}
