import {delay, fail, UserData} from "../../../common";
import AuthBase from "../AuthBase";
import loadUserData from "../loadUserData";
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
export default class LocalAuth extends AuthBase {
    #UserData;

    constructor({storageKey = "redequate:auth:local", database, UserData: Component = UserData} = {}) {
        super();
        if (!storageKey.trim()) {
            fail("auth/invalid-argument", "storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
        this.#UserData = Component;
        this.database = database;
    }

    async createUserWithEmailAndPassword(email, password) {
        return createUserWithEmailAndPassword(this, email, password, this.#UserData);
    }

    async signInWithEmailAndPassword(email, password) {
        return signInWithEmailAndPassword(this, email, password, this.#UserData);
    }

    async onAuthStateChanged(callback, onError) {
        return onAuthStateChanged(this, callback, onError, this.#UserData);
    }

    async resolveCurrentUser() {
        await delay("LocalAuth", "resolveCurrentUser");
        const state = read(this);
        return loadUserData(toUserData(state.accounts.find(account => account.uid === state.session?.uid), this.#UserData, this.database), this.database);
    }

    async signOut() {
        await delay("LocalAuth", "signOut");
        const state = read(this);
        state.session = null;
        state.redirect = null;
        write(this, state);
    }

    async signInWithPopup(provider, options) {
        await delay("LocalAuth", "signInWithPopup");
        const state = read(this);
        return login(this, state, providerAccount(state, provider), this.#UserData);
    }

    async signInWithCredential(credential) {
        return signInWithCredential(this, credential, this.#UserData);
    }

    async signInWithRedirect(provider, options) {
        await delay("LocalAuth", "signInWithRedirect");
        const state = read(this);
        const account = providerAccount(state, provider);
        state.redirect = account.uid;
        await login(this, state, account, this.#UserData);
    }

    async resolveRedirectResult() {
        await delay("LocalAuth", "resolveRedirectResult");
        const state = read(this);
        if (!state.redirect) return null;
        const account = state.accounts.find(item => item.uid === state.redirect);
        const previousState = JSON.stringify(state);
        const user = await loadUserData(toUserData(account, this.#UserData, this.database), this.database);
        if (JSON.stringify(read(this)) !== previousState) {
            fail("auth/state-changed", "Local authentication changed while resolving redirect.");
        }
        state.redirect = null;
        write(this, state);
        return user;
    }

    async sendEmailVerification(options) {
        await delay("LocalAuth", "sendEmailVerification");
        const state = read(this);
        const account = current(state);
        account.emailVerified = true;
        recordMail(state, "verification", account.email, options);
        write(this, state);
    }

    async sendPasswordResetEmail(email, options) {
        await delay("LocalAuth", "sendPasswordResetEmail");
        email = normalizeEmail(email);
        const state = read(this);
        if (!state.accounts.some(account => account.email === email)) fail("auth/user-not-found", "Account not found.");
        recordMail(state, "password-reset", email, options);
        write(this, state);
    }

    async sendSignInLinkToEmail(email, options) {
        await delay("LocalAuth", "sendSignInLinkToEmail");
        email = normalizeEmail(email);
        const state = read(this);
        if (!state.links.includes(email)) state.links.push(email);
        recordMail(state, "sign-in", email, options);
        write(this, state);
    }

    async checkSignInWithEmailLink() {
        await delay("LocalAuth", "checkSignInWithEmailLink");
        return read(this).links.length > 0;
    }

    async signInWithEmailLink(email) {
        return signInWithEmailLink(this, email, this.#UserData);
    }

    async updatePassword(password) {
        await changePassword(this, password);
    }

    async updateProfile(fields) {
        return updateProfile(this, fields);
    }
}
