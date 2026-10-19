import {delay, fail} from "../../../common";
import {normalizeEmail, read, login} from "./common";

export default async function signInWithEmailAndPassword(auth, email, password, createUserData) {
    await delay("LocalAuth", "signInWithEmailAndPassword");
    email = normalizeEmail(email);
    const state = await read(auth);
    const account = state.accounts.find(item => item.email === email);
    if (!account || account.password === null || account.password !== password) {
        fail("auth/invalid-credential", "Invalid email or password.");
    }
    return login(auth, state, account, createUserData);
}
