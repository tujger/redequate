import {delay, fail} from "../../../_common/src/_packages";
import AuthBase from "../AuthBase";
import {
    changePassword,
    current,
    login,
    normalizeEmail,
    providerAccount,
    read,
    recordMail,
    toUserData,
    write
} from "./common";
import createUserWithEmailAndPassword from "./createUserWithEmailAndPassword";
import onAuthStateChanged from "./onAuthStateChanged";
import signInWithCredential from "./signInWithCredential";
import signInWithEmailAndPassword from "./signInWithEmailAndPassword";
import signInWithEmailLink from "./signInWithEmailLink";
import updateProfile from "./updateProfile";

// Local simulation only: passwords and fake tokens are stored in plain text.
export default class LocalTestAuth extends AuthBase {
    constructor({storageKey = "redequate:auth:local-test"} = {}) {
        super();
        if (!storageKey.trim()) {
            fail("auth/invalid-argument", "storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
    }

    async createUserWithEmailAndPassword(email, password) {
        return createUserWithEmailAndPassword(this, email, password);
    }

    async signInWithEmailAndPassword(email, password) {
        return signInWithEmailAndPassword(this, email, password);
    }

    async onAuthStateChanged(callback, onError) {
        return onAuthStateChanged(this, callback, onError);
    }

    async resolveCurrentUser() {
        await delay("LocalTestAuth", "resolveCurrentUser");
        const state = read(this);
        return toUserData(state.accounts.find(account => account.uid === state.session?.uid));
    }

    async signOut() {
        await delay("LocalTestAuth", "signOut");
        const state = read(this);
        state.session = null;
        state.redirect = null;
        write(this, state);
    }

    async signInWithPopup(provider, options) {
        await delay("LocalTestAuth", "signInWithPopup");
        const state = read(this);
        return login(this, state, providerAccount(state, provider));
    }

    async signInWithCredential(credential) {
        return signInWithCredential(this, credential);
    }

    async signInWithRedirect(provider, options) {
        await delay("LocalTestAuth", "signInWithRedirect");
        const state = read(this);
        const account = providerAccount(state, provider);
        state.redirect = account.uid;
        login(this, state, account);
    }

    async resolveRedirectResult() {
        await delay("LocalTestAuth", "resolveRedirectResult");
        const state = read(this);
        if (!state.redirect) return null;
        const account = state.accounts.find(item => item.uid === state.redirect);
        state.redirect = null;
        write(this, state);
        return toUserData(account);
    }

    async sendEmailVerification(options) {
        await delay("LocalTestAuth", "sendEmailVerification");
        const state = read(this);
        const account = current(state);
        account.emailVerified = true;
        recordMail(state, "verification", account.email, options);
        write(this, state);
    }

    async sendPasswordResetEmail(email, options) {
        await delay("LocalTestAuth", "sendPasswordResetEmail");
        email = normalizeEmail(email);
        const state = read(this);
        if (!state.accounts.some(account => account.email === email)) fail("auth/user-not-found", "Account not found.");
        recordMail(state, "password-reset", email, options);
        write(this, state);
    }

    async sendSignInLinkToEmail(email, options) {
        await delay("LocalTestAuth", "sendSignInLinkToEmail");
        email = normalizeEmail(email);
        const state = read(this);
        if (!state.links.includes(email)) state.links.push(email);
        recordMail(state, "sign-in", email, options);
        write(this, state);
    }

    async checkSignInWithEmailLink() {
        await delay("LocalTestAuth", "checkSignInWithEmailLink");
        return read(this).links.length > 0;
    }

    async signInWithEmailLink(email) {
        return signInWithEmailLink(this, email);
    }

    async updatePassword(password) {
        await changePassword(this, password);
    }

    async updateProfile(fields) {
        return updateProfile(this, fields);
    }
}
