import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getDatabase} from "firebase-admin/database";
import parseCreatePath from "../../../../database/src/common/parseCreatePath";
import resolvePath from "../../../../database/src/common/resolvePath";

// Firebase forbids ASCII control characters in keys and paths.
// eslint-disable-next-line no-control-regex
const invalidPath = /[.#$[\]\x00-\x1f\x7f]/;

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
    const authorization = request.rawRequest?.headers?.authorization;
    const token = request.auth && typeof authorization === "string"
        ? /^Bearer (.+)$/i.exec(authorization)?.[1]
        : undefined;
    if (request.auth && !token) throw new HttpsError("unauthenticated", "A Firebase ID token is required.");
    const database = getDatabase();
    const collection = database.ref(parent);
    const reference = key === undefined ? collection.push() : collection.child(key);
    const url = new URL(reference.toString());
    url.pathname += ".json";
    if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
        const databaseUrl = new URL(database.app.options.databaseURL);
        url.searchParams.set("ns", databaseUrl.searchParams.get("ns") ?? databaseUrl.hostname.split(".")[0]);
    }
    if (token) url.searchParams.set("auth", token);
    return {key: reference.key, url, value};
};

export default onCall(async request => {
    try {
        const {key, url, value} = prepare(request);
        // The caller's ID token makes Database Rules authorize the actual write.
        const response = await fetch(url, {
            method: "PUT",
            headers: {"Content-Type": "application/json", "If-Match": "null_etag"},
            body: JSON.stringify(value),
            signal: AbortSignal.timeout(30000),
            redirect: "error",
        }).catch(error => {
            throw new HttpsError(error.name === "TimeoutError" ? "deadline-exceeded" : "unavailable", "Database request failed.");
        });
        await response.body?.cancel();
        const code = {400: "invalid-argument", 401: "permission-denied", 403: "permission-denied", 412: "already-exists"}[response.status];
        if (!response.ok) throw new HttpsError(code ?? (response.status >= 500 ? "unavailable" : "internal"), "Record creation failed.");
        return key;
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (error.code === "database/invalid-argument" || error.code === "database/invalid-path") {
            throw new HttpsError("invalid-argument", error.message);
        }
        throw new HttpsError("internal", "Record creation failed.");
    }
});
