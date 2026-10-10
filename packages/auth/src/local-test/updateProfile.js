import {delay, fail} from "../../../_common/src/_packages";
import {read, write, current} from "./common";

export default async function updateProfile(auth, fields) {
    await delay("LocalTestAuth", "updateProfile");
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
        fail("auth/invalid-argument", "Profile fields must be an object.");
    }
    const state = read(auth);
    const account = current(state);
    for (const field of ["displayName", "photoURL"]) {
        if (fields[field] !== undefined) {
            if (fields[field] !== null && typeof fields[field] !== "string") {
                fail("auth/invalid-argument", `${field} must be a string or null.`);
            }
            account[field] = fields[field];
        }
    }
    write(auth, state);
}
