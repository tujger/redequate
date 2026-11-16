import {HttpsError} from "firebase-functions/v2/https";

export default function getRequestToken(request) {
    const authorization = request.rawRequest?.headers?.authorization;
    const token = request.auth && typeof authorization === "string"
        ? /^Bearer (.+)$/i.exec(authorization)?.[1]
        : undefined;
    if (request.auth && !token) throw new HttpsError("unauthenticated", "A Firebase ID token is required.");
    return token;
}
