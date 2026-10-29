import {onValueCreated, onValueDeleted, onValueUpdated} from "firebase-functions/v2/database";
import parseReadPath from "../../../../../database/src/common/parseReadPath.js";
import resolvePath from "../../../../../database/src/common/resolvePath.ts";

export default listener => {
    const {path: parentPath, keyField} = parseReadPath(listener.path);
    const ref = resolvePath(keyField ? [...parentPath, `{${keyField}}`] : parentPath);
    const address = `/${ref}`;
    return {
        onCreate: listener.onCreate && onValueCreated(address, ({data, params}) => listener.onCreate({value: data.val(), params})),
        onDelete: listener.onDelete && onValueDeleted(address, ({data, params}) => listener.onDelete({value: data.val(), params})),
        onUpdate: listener.onUpdate && onValueUpdated(address, ({data, params}) => listener.onUpdate({
            params, previous: data.before.val(), value: data.after.val(),
        })),
    };
};
