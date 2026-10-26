import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getDatabase} from "firebase-admin/database";
import resolvePath from "../../../../database/src/common/resolvePath";

// eslint-disable-next-line no-control-regex
const invalidPath = /[.#$[\]\x00-\x1f\x7f]/;

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
    const authorization = request.rawRequest?.headers?.authorization;
    const token = request.auth && typeof authorization === "string"
        ? /^Bearer (.+)$/i.exec(authorization)?.[1]
        : undefined;
    if (request.auth && !token) throw new HttpsError("unauthenticated", "A Firebase ID token is required.");
    const database = getDatabase();
    const reference = address ? database.ref(address) : database.ref();
    const url = new URL(reference.toString());
    url.pathname += ".json";
    if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
        const databaseUrl = new URL(database.app.options.databaseURL);
        url.searchParams.set("ns", databaseUrl.searchParams.get("ns") ?? databaseUrl.hostname.split(".")[0]);
    }
    if (token) url.searchParams.set("auth", token);
    if (mode === "patch") url.searchParams.set("print", "silent");
    return {url, mode, value, etag: options.etag};
};

const sendRequest = async props => {
    const {url, mode, value, etag} = props;
    const headers = {"Content-Type": "application/json"};
    if (mode !== "patch") headers["X-Firebase-ETag"] = "true";
    if (mode === "replace") headers["If-Match"] = etag;
    // Forward the caller's token so Rules authorize reads and writes alike.
    const response = await fetch(url, {
        method: {patch: "PATCH", read: "GET", replace: "PUT"}[mode],
        headers,
        ...(mode === "read" ? {} : {body: JSON.stringify(value)}),
        signal: AbortSignal.timeout(30000),
        redirect: "error",
    }).catch(error => {
        throw new HttpsError(error.name === "TimeoutError" ? "deadline-exceeded" : "unavailable", "Database request failed.");
    });
    return {...props, response};
};

const readResponse = async props => {
    const {mode, response} = props;
    const conflict = mode === "replace" && response.status === 412;
    if (!response.ok && !conflict) {
        await response.body?.cancel();
        const code = {400: "invalid-argument", 401: "permission-denied", 403: "permission-denied"}[response.status];
        throw new HttpsError(code ?? (response.status >= 500 ? "unavailable" : "internal"), "Record update failed.");
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
        return await Promise.resolve(prepare(request)).then(sendRequest).then(readResponse);
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (["database/invalid-argument", "database/invalid-path"].includes(error?.code)) {
            throw new HttpsError("invalid-argument", error.message);
        }
        if (["TimeoutError", "AbortError"].includes(error?.name)) {
            throw new HttpsError("deadline-exceeded", "Database request failed.");
        }
        throw new HttpsError("internal", "Record update failed.");
    }
});
