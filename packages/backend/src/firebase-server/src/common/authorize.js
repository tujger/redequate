import {HttpsError} from "firebase-functions/v2/https";
import validateKey from "./validateKey.js";

export default async (request, database, {adminOnly = false, uid} = {}) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
    if (!request.data || typeof request.data !== "object" || Array.isArray(request.data)) {
        throw new HttpsError("invalid-argument", "Function arguments must be an object.");
    }
    if (uid !== undefined) validateKey(uid, "uid");
    if (adminOnly || (uid !== undefined && uid !== request.auth.uid)) {
        const role = (await database.ref("roles").child(request.auth.uid).get()).val();
        if (role !== "admin") throw new HttpsError("permission-denied", "Not authorized for this operation.");
    }
};
