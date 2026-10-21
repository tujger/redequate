import parseReadPath from "../common/parseReadPath";
import resolvePath from "../common/resolvePath";
import {applyReadOptions, readQueryOptions} from "../common/applyReadOptions";
import {fail} from "../../../common";

export default async function read(firebase, path, options = {}) {
    const effectivePath = resolvePath(parseReadPath(path).path);
    if (!effectivePath) fail("database/invalid-argument", "read requires a non-empty path.");
    const {field, equalTo, start, end} = readQueryOptions(options);

    let ref = firebase.database().ref(effectivePath);
    if (field !== undefined) ref = field === "" ? ref.orderByValue() : ref.orderByChild(field);
    else if (equalTo !== undefined) ref = ref.orderByValue();
    else if (start !== undefined || end !== undefined) ref = ref.orderByKey();
    if (equalTo !== undefined) ref = ref.equalTo(equalTo);
    if (start !== undefined) ref = ref.startAt(start);
    if (end !== undefined) ref = ref.endAt(end);
    const snapshot = await ref.once("value");
    if (!snapshot.exists()) return undefined;
    return (field !== undefined || equalTo !== undefined || start !== undefined
        || end !== undefined || options.order !== undefined)
        ? applyReadOptions(snapshot.val(), options) : snapshot.val();
}
