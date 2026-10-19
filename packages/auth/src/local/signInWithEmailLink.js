import {delay, fail} from "../../../common";
import {normalizeEmail, read, createAccount, login} from "./common";

export default async function signInWithEmailLink(auth, email, createUserData) {
    await delay("LocalAuth", "signInWithEmailLink");
    email = normalizeEmail(email);
    const state = await read(auth);
    if (!state.links.some(link => link.email === email)) fail("auth/invalid-action-code", "No pending sign-in request for this email.");
    let account = state.accounts.find(item => item.email === email);
    if (!account) {
        account = createAccount(email);
        state.accounts.push(account);
    }
    account.emailVerified = true;
    state.links = state.links.filter(item => item.email !== email);
    return login(auth, state, account, createUserData);
}
