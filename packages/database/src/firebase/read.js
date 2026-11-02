import {
    endAt,
    equalTo as equalToConstraint,
    getDatabase,
    orderByChild,
    orderByKey,
    orderByValue,
    query,
    ref,
    startAt
} from "firebase/database";
import {fail} from "../../../common";
import applyReadOptions, {readQueryOptions} from "../common/applyReadOptions";
import parsePath from "./parsePath";
import readSnapshot from "./readSnapshot";

export async function read(firebase, path, options = {}) {
    const {address: effectivePath} = parsePath(path, "collection");
    if (!effectivePath) fail("database/invalid-argument", "read requires a non-empty path.");
    const {field, equalTo, start, end} = readQueryOptions(options);

    let selection = ref(getDatabase(firebase.app), effectivePath);
    if (field !== undefined) {
        selection = query(selection, field === "" ? orderByValue() : orderByChild(field));
    } else if (equalTo !== undefined) {
        selection = query(selection, orderByValue());
    } else if (start !== undefined || end !== undefined) {
        selection = query(selection, orderByKey());
    }
    if (equalTo !== undefined) {
        selection = query(selection, equalToConstraint(equalTo));
    }
    if (start !== undefined) {
        selection = query(selection, startAt(start));
    }
    if (end !== undefined) selection = query(selection, endAt(end));
    const snapshot = await readSnapshot(selection);
    if (!snapshot.exists()) {
        return undefined;
    }
    if (field !== undefined || equalTo !== undefined || start !== undefined || end !== undefined || options.order !== undefined) {
        return applyReadOptions(snapshot.val(), options);
    } else {
        return snapshot.val();
    }
}
