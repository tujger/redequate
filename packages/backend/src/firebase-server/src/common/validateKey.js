import {HttpsError} from "firebase-functions/v2/https";

export default (value, name) => {
    if (typeof value !== "string" || !value || /[.#$[\]/]/.test(value)) {
        throw new HttpsError("invalid-argument", `${name} must be a database key.`);
    }
};
