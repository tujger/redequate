import AuthBase from "../AuthBase";
import parseUser from "./from";
import createUserWithEmailAndPassword from "./createUserWithEmailAndPassword";
import signInWithEmailAndPassword from "./signInWithEmailAndPassword";
import onAuthStateChanged from "./onAuthStateChanged";
import signInWithCredential from "./signInWithCredential";
import signInWithEmailLink from "./signInWithEmailLink";
import updateProfile from "./updateProfile";
import {fail, normalizeEmail, identifier, delay, read, write, current, createUser, login, providerAccount, recordMail, changePassword} from "./common";

// Local simulation only: passwords and fake tokens are stored in plain text.
export default class LocalTestAuth extends AuthBase {
    constructor({storageKey = "redequate:auth:local-test"} = {}) {
        super();
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            fail("invalid-argument", "storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
    }

    from(json) {
        return parseUser(json);
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
        await delay("resolveCurrentUser");
        const state = read(this);
        return createUser(this, state.accounts.find(account => account.uid === state.session?.uid));
    }

    async resolveToken(forceRefresh = false) {
        await delay("resolveToken");
        const state = read(this);
        if (!state.session) return null;
        if (forceRefresh) {
            state.session.token = `local-test:${identifier()}`;
            write(this, state);
        }
        return state.session.token;
    }

    async signOut() {
        await delay("signOut");
        const state = read(this);
        state.session = null;
        state.redirect = null;
        write(this, state);
    }

    async signInWithPopup(provider, options) {
        await delay("signInWithPopup");
        const state = read(this);
        return login(this, state, providerAccount(state, provider));
    }

    async signInWithCredential(credential) {
        return signInWithCredential(this, credential);
    }

    async signInWithRedirect(provider, options) {
        await delay("signInWithRedirect");
        const state = read(this);
        const account = providerAccount(state, provider);
        state.redirect = account.uid;
        login(this, state, account);
    }

    async resolveRedirectResult() {
        await delay("resolveRedirectResult");
        const state = read(this);
        if (!state.redirect) return null;
        const account = state.accounts.find(item => item.uid === state.redirect);
        state.redirect = null;
        write(this, state);
        return {user: createUser(this, account)};
    }

    async sendEmailVerification(options) {
        await delay("sendEmailVerification");
        const state = read(this);
        const account = current(state);
        account.emailVerified = true;
        recordMail(state, "verification", account.email, options);
        write(this, state);
    }

    async sendPasswordResetEmail(email, options) {
        await delay("sendPasswordResetEmail");
        email = normalizeEmail(email);
        const state = read(this);
        if (!state.accounts.some(account => account.email === email)) fail("user-not-found", "Account not found.");
        recordMail(state, "password-reset", email, options);
        write(this, state);
    }

    async sendSignInLinkToEmail(email, options) {
        await delay("sendSignInLinkToEmail");
        email = normalizeEmail(email);
        const state = read(this);
        if (!state.links.includes(email)) state.links.push(email);
        recordMail(state, "sign-in", email, options);
        write(this, state);
    }

    async checkSignInWithEmailLink() {
        await delay("checkSignInWithEmailLink");
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
