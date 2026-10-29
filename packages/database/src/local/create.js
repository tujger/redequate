import {fail} from "../../../common";
import {key as generateKey} from "firebase-key";
import parsePath from "../common/parsePath";

export default async function createRecord(path, value, run, superCreate) {
    return run(() => {
        const parsed = parsePath(path);
        if (parsed.literal || parsed.path.length < 2) fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
        const last = parsed.path.at(-1);
        const fieldName = typeof last === "string" ? last : parsed.segments.at(-1).name;
        const key = (typeof last === "string" ? undefined : last[fieldName]) ?? generateKey();
        return superCreate(path, value, {key});
    }, undefined, "create", {path, value});
}
