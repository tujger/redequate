import {delay, fail} from "../../../_common/src/_packages";
import {normalizeEmail, read, login} from "./common";

export default async function signInWithEmailAndPassword(auth, email, password) {
    await delay("LocalTestAuth", "signInWithEmailAndPassword");
    email = normalizeEmail(email);
    const state = read(auth);
    const account = state.accounts.find(item => item.email === email);
    if (!account || typeof password !== "string" || account.password === null || account.password !== password) {
        fail("auth/invalid-credential", "Invalid email or password.");
    }
    return login(auth, state, account);
}
