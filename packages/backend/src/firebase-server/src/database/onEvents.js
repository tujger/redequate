import {onValueCreated, onValueDeleted, onValueUpdated} from "firebase-functions/v2/database";
import parsePath from "../../../../../database/src/firebase/parsePath";

export default listener => {
    const {address: ref, fixedParams} = parsePath(listener.path, "listener");
    const address = `/${ref}`;
    return {
        onCreate: listener.onCreate && onValueCreated(address, ({data, params}) => listener.onCreate({value: data.val(), params: {...fixedParams, ...params}})),
        onDelete: listener.onDelete && onValueDeleted(address, ({data, params}) => listener.onDelete({value: data.val(), params: {...fixedParams, ...params}})),
        onUpdate: listener.onUpdate && onValueUpdated(address, ({data, params}) => listener.onUpdate({
            params: {...fixedParams, ...params}, previous: data.before.val(), value: data.after.val(),
        })),
    };
};
