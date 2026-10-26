import {HttpsError} from "firebase-functions/v2/https";

export default function throwDatabaseError(error, message, {timeouts = true} = {}) {
    if (error instanceof HttpsError) throw error;
    if (["database/invalid-argument", "database/invalid-path"].includes(error?.code)) {
        throw new HttpsError("invalid-argument", error.message);
    }
    if (timeouts && ["TimeoutError", "AbortError"].includes(error?.name)) {
        throw new HttpsError("deadline-exceeded", "Database request failed.");
    }
    throw new HttpsError("internal", message);
}
