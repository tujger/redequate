import {getDatabase} from "firebase-admin/database";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import resolvePath from "../../../../../../database/src/common/resolvePath";
import checkResponse from "../../common/checkResponse";
import createDatabaseUrl from "../../common/createDatabaseUrl";
import getRequestToken from "../../common/getRequestToken";
import invalidPath from "../../common/invalidPath";
import sendRequest from "../../common/sendRequest";
import throwDatabaseError from "../../common/throwDatabaseError";

const prepare = request => {
    const args = request.data;
    if (!(args instanceof Array) || ![2, 3].includes(args.length)) {
        throw new HttpsError("invalid-argument", "Expected (path, changes, options?).");
    }
    const [path, value, options = {}] = args;
    if (options === null || typeof options !== "object" || options instanceof Array) {
        throw new HttpsError("invalid-argument", "Invalid update options.");
    }
    const mode = options.mode ?? "patch";
    if (!["patch", "read", "replace"].includes(mode)) throw new HttpsError("invalid-argument", "Invalid update mode.");
    const address = resolvePath(path);
    if (invalidPath.test(address)) throw new HttpsError("invalid-argument", "Invalid Firebase path.");
    if (mode === "read" && value !== null) throw new HttpsError("invalid-argument", "Read requires a null value.");
    if (mode === "patch" && (value === null || typeof value !== "object" || value instanceof Array)) {
        throw new HttpsError("invalid-argument", "changes must be an object.");
    }
    if (mode === "replace" && (typeof options.etag !== "string" || !options.etag.length || /[\r\n]/.test(options.etag))) {
        throw new HttpsError("invalid-argument", "Conditional replacement requires an ETag.");
    }
    const token = getRequestToken(request);
    const database = getDatabase();
    const reference = address ? database.ref(address) : database.ref();
    const url = createDatabaseUrl({database, reference, token});
    if (mode === "patch") url.searchParams.set("print", "silent");
    return {url, mode, value, etag: options.etag};
};

const prepareRequest = props => {
    const {mode, value, etag} = props;
    const headers = {"Content-Type": "application/json"};
    if (mode !== "patch") headers["X-Firebase-ETag"] = "true";
    if (mode === "replace") headers["If-Match"] = etag;
    return {
        ...props,
        method: {patch: "PATCH", read: "GET", replace: "PUT"}[mode],
        headers,
        ...(mode === "read" ? {} : {body: JSON.stringify(value)}),
    };
};

const readResponse = async props => {
    const {mode, response} = props;
    const conflict = mode === "replace" && response.status === 412;
    if (!response.ok && !conflict) {
        await response.body?.cancel();
        checkResponse(response, "Record update failed.");
    }
    if (mode === "patch") {
        await response.body?.cancel();
        return null;
    }
    const value = await response.json();
    if (mode === "replace" && !conflict) return {committed: true, value};
    const etag = response.headers.get("etag");
    if (!etag) throw new HttpsError("internal", "Database response did not include an ETag.");
    return mode === "read" ? {value, etag} : {committed: false, value, etag};
};

export default onCall(async request => {
    try {
        return await Promise.resolve(prepare(request)).then(prepareRequest).then(sendRequest).then(readResponse);
    } catch (error) {
        throwDatabaseError(error, "Record update failed.");
    }
});
