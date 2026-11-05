import {onValueCreated, onValueDeleted, onValueUpdated} from "firebase-functions/v2/database";
import parsePath from "../../../../../database/src/firebase/parsePath";
import userContext from "../common/userContext";

const withUser = handler => event => {
    let uid = event.authId ?? undefined;
    if (uid === undefined && process.env.FUNCTIONS_EMULATOR === "true") {
        // Test-only owner substitution; production must use native event auth.
        const value = (event.data.after ?? event.data).val();
        if (typeof value?.uid === "string" && value.uid.length > 0) uid = value.uid;
    }
    return userContext.run(
        uid,
        () => handler(event),
    );
};

export default listener => {
    const {address: ref, fixedParams} = parsePath(listener.path, "listener");
    const address = `/${ref}`;
    return {
        onCreate: listener.onCreate && onValueCreated(address, withUser(({data, params}) => listener.onCreate({value: data.val(), params: {...fixedParams, ...params}}))),
        onDelete: listener.onDelete && onValueDeleted(address, withUser(({data, params}) => listener.onDelete({value: data.val(), params: {...fixedParams, ...params}}))),
        onUpdate: listener.onUpdate && onValueUpdated(address, withUser(({data, params}) => listener.onUpdate({
            params: {...fixedParams, ...params}, previous: data.before.val(), value: data.after.val(),
        }))),
    };
};
