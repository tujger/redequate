import {fail, normalizeEmail, delay, read, login} from "./common";

export default async function signInWithEmailAndPassword(auth, email, password) {
    await delay("signInWithEmailAndPassword");
    email = normalizeEmail(email);
    const state = read(auth);
    const account = state.accounts.find(item => item.email === email);
    if (!account || typeof password !== "string" || account.password === null || account.password !== password) {
        fail("invalid-credential", "Invalid email or password.");
    }
    return login(auth, state, account);
}
