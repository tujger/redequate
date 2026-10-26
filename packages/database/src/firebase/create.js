import {getDatabase, ref, push} from "firebase/database";
import {fail} from "../../../common";
import FirebaseBackendClient from "../../../backend/src/firebase-client";
import resolvePath from "../common/resolvePath";
import parseCreatePath from "../common/parseCreatePath";

export default function createRecord(firebase, backend, path, value, run) {
    return run(() => saveRecord(prepareRecord({firebase, backend, path, value})),
        undefined, "create", {path, value});
}

const prepareRecord = props => {
    const {firebase, path} = props;
    let {value} = props;
    const {parentPath, fieldName, key} = parseCreatePath(path);
    let effectivePath = path;
    if (value instanceof Function) {
        const recordKey = key ?? push(ref(getDatabase(firebase.app), resolvePath(parentPath))).key;
        value = value(recordKey);
        effectivePath = [...parentPath, {[fieldName]: recordKey}];
    }
    if (value?.then instanceof Function) {
        Promise.resolve(value).catch(() => {});
        fail("database/invalid-argument", "create callback must be synchronous.");
    }
    if (value === null || typeof value !== "object" || value instanceof Array) {
        fail("database/invalid-argument", "value must be a record object.");
    }
    return {...props, path: effectivePath, value};
};

async function saveRecord(props) {
    const {firebase, backend, path, value} = props;
    try {
        const client = backend ?? new FirebaseBackendClient({firebase});
        return await client.request("database.create", path, value);
    } catch (error) {
        if (error.code === "functions/already-exists") {
            fail("database/conflict", "Record already exists.");
        }
        throw error;
    }
}
