import {fail, normalizeEmail, checkPassword, delay, read, createAccount, login} from "./common";

export default async function createUserWithEmailAndPassword(auth, email, password) {
    await delay("createUserWithEmailAndPassword");
    email = normalizeEmail(email);
    checkPassword(password);
    const state = read(auth);
    if (state.accounts.some(account => account.email === email)) {
        fail("email-already-in-use", "This email is already registered.");
    }
    const account = createAccount(email, "password", password);
    state.accounts.push(account);
    return login(auth, state, account);
}
