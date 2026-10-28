import {onValueWritten} from "firebase-functions/v2/database";
import parseReadPath from "../../../../../database/src/common/parseReadPath.js";
import resolvePath from "../../../../../database/src/common/resolvePath.ts";

export default ({path, onWrite}) => {
    const {path: parentPath, keyField} = parseReadPath(path);
    const ref = resolvePath(keyField ? [...parentPath, `{${keyField}}`] : parentPath);
    return onValueWritten(`/${ref}`, ({data, params}) => onWrite({
        params,
        previous: data.before.val(),
        value: data.after.val(),
    }));
};
