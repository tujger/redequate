import {delay, fail} from "../../../_common/src/_packages";
import {normalizeEmail, read, createAccount, login} from "./common";

export default async function signInWithEmailLink(auth, email) {
    await delay("LocalTestAuth", "signInWithEmailLink");
    email = normalizeEmail(email);
    const state = read(auth);
    if (!state.links.includes(email)) fail("auth/invalid-action-code", "No pending sign-in request for this email.");
    let account = state.accounts.find(item => item.email === email);
    if (!account) {
        account = createAccount(email);
        state.accounts.push(account);
    }
    account.emailVerified = true;
    state.links = state.links.filter(item => item !== email);
    return login(auth, state, account);
}
