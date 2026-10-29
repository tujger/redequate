import {getDatabase, ref, query, orderByValue, orderByChild, orderByKey, equalTo as equalToConstraint, startAt, endAt} from "firebase/database";
import readSnapshot from "./readSnapshot";
import parsePath from "../common/parsePath";
import resolvePath from "../common/resolvePath";
import applyReadOptions, {readQueryOptions} from "../common/applyReadOptions";
import {fail} from "../../../common";

export default async function read(firebase, path, options = {}) {
    const parsed = parsePath(path);
    const collection = !parsed.literal && parsed.path.length > 1 && typeof parsed.path.at(-1) === "string";
    const effectivePath = resolvePath(collection ? parsed.path.slice(0, -1) : parsed.path);
    if (!effectivePath) fail("database/invalid-argument", "read requires a non-empty path.");
    const {field, equalTo, start, end} = readQueryOptions(options);

    let selection = ref(getDatabase(firebase.app), effectivePath);
    if (field !== undefined) selection = query(selection, field === "" ? orderByValue() : orderByChild(field));
    else if (equalTo !== undefined) selection = query(selection, orderByValue());
    else if (start !== undefined || end !== undefined) selection = query(selection, orderByKey());
    if (equalTo !== undefined) selection = query(selection, equalToConstraint(equalTo));
    if (start !== undefined) selection = query(selection, startAt(start));
    if (end !== undefined) selection = query(selection, endAt(end));
    const snapshot = await readSnapshot(selection);
    if (!snapshot.exists()) return undefined;
    return (field !== undefined || equalTo !== undefined || start !== undefined
        || end !== undefined || options.order !== undefined)
        ? applyReadOptions(snapshot.val(), options) : snapshot.val();
}
