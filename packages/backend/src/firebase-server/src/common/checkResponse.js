import {HttpsError} from "firebase-functions/v2/https";

const codes = {400: "invalid-argument", 401: "permission-denied", 403: "permission-denied"};

export default function checkResponse(response, message, overrides = {}) {
    if (response.ok) return;
    const code = overrides[response.status] ?? codes[response.status] ??
        (response.status >= 500 ? "unavailable" : "internal");
    throw new HttpsError(code, message);
}
