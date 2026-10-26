import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getDatabase} from "firebase-admin/database";
import parseCreatePath from "../../../../../database/src/common/parseCreatePath";
import resolvePath from "../../../../../database/src/common/resolvePath";

import invalidPath from "../common/invalidPath";
import getRequestToken from "../common/getRequestToken";
import createDatabaseUrl from "../common/createDatabaseUrl";
import sendRequest from "../common/sendRequest";
import checkResponse from "../common/checkResponse";
import throwDatabaseError from "../common/throwDatabaseError";

const prepare = request => {
    const args = request.data;
    if (!(args instanceof Array) || args.length !== 2) {
        throw new HttpsError("invalid-argument", "Expected (path, value).");
    }
    const [path, value] = args;
    const {parentPath, key} = parseCreatePath(path);
    if (value === null || typeof value !== "object" || value instanceof Array) {
        throw new HttpsError("invalid-argument", "value must be a record object.");
    }
    const parent = resolvePath(parentPath);
    if (invalidPath.test(parent) || (key !== undefined && (invalidPath.test(key) || key.includes("/")))) {
        throw new HttpsError("invalid-argument", "Invalid Firebase path or record key.");
    }
    const token = getRequestToken(request);
    const database = getDatabase();
    const collection = database.ref(parent);
    const reference = key === undefined ? collection.push() : collection.child(key);
    const url = createDatabaseUrl({database, reference, token});
    return {key: reference.key, url, value};
};

const prepareRequest = props => {
    const {value} = props;
    return {...props,
        method: "PUT",
        headers: {"Content-Type": "application/json", "If-Match": "null_etag"},
        body: JSON.stringify(value),
    };
};

const readResponse = async props => {
    const {key, response} = props;
    await response.body?.cancel();
    checkResponse(response, "Record creation failed.", {412: "already-exists"});
    return key;
};

export default onCall(async request => {
    try {
        return await Promise.resolve(prepare(request)).then(prepareRequest).then(sendRequest).then(readResponse);
    } catch (error) {
        throwDatabaseError(error, "Record creation failed.", {timeouts: false});
    }
});
