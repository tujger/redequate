import {getDatabase, ref, push} from "firebase/database";
import {fail} from "../../../common";
import parsePath from "../common/parsePath";
import resolvePath from "../common/resolvePath";

const mapCreateError = error => {
    if (error.code === "functions/already-exists") {
        fail("database/conflict", "Record already exists.");
    }
    return error;
};

export default async function createRecord(firebase, path, value, run, superCreate) {
    return run(() => {
        const parsed = parsePath(path);
        if (parsed.literal || parsed.path.length < 2) fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
        const parentPath = parsed.path.slice(0, -1);
        const last = parsed.path.at(-1);
        const fieldName = typeof last === "string" ? last : parsed.segments.at(-1).name;
        const suppliedKey = typeof last === "string" ? undefined : last[fieldName];
        const key = suppliedKey ?? (value instanceof Function
            ? push(ref(getDatabase(firebase.app), resolvePath(parentPath))).key
            : undefined);
        return superCreate(path, value, {key, mapError: mapCreateError});
    }, undefined, "create", {path, value});
}
