import {fail, normalizeEmail, delay, read, createAccount, login} from "./common";

export default async function signInWithEmailLink(auth, email) {
    await delay("signInWithEmailLink");
    email = normalizeEmail(email);
    const state = read(auth);
    if (!state.links.includes(email)) fail("invalid-action-code", "No pending sign-in request for this email.");
    let account = state.accounts.find(item => item.email === email);
    if (!account) {
        account = createAccount(email);
        state.accounts.push(account);
    }
    account.emailVerified = true;
    state.links = state.links.filter(item => item !== email);
    return login(auth, state, account);
}
