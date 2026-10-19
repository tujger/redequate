import {delay, fail, identifier} from "../../../common";
import AuthBase from "../AuthBase";
import observeAuthState from "../common/observeAuthState";
import emailOptions from "../common/emailOptions";
import loadUserData from "../common/loadUserData";
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
    constructor(options = {}) {
        super(options);
        const {storageKey = "redequate:auth:local"} = options;
        if (!storageKey.trim()) {
            fail("auth/invalid-argument", "storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
    }

    async createUserWithEmailAndPassword(email, password) {
        super.createUserWithEmailAndPassword(email, password);
        return createUserWithEmailAndPassword(this, email, password, this._createUserData);
    }

    async signInWithEmailAndPassword(email, password) {
        super.signInWithEmailAndPassword(email, password);
        return signInWithEmailAndPassword(this, email, password, this._createUserData);
    }

    async onAuthStateChanged(callback, onError) {
        super.onAuthStateChanged(callback, onError);
        return observeAuthState({
            auth: this, callback, onError,
            subscribe: (next, error) => onAuthStateChanged(this, next, error, this._createUserData),
            signature: user => JSON.stringify({id: user.id, public: user.public, role: user.role, private: user.private})
        });
    }

    async resolveCurrentUser(options = {}) {
        super.resolveCurrentUser(options);
        const {skipDelay = false} = options;
        if (!skipDelay) await delay("LocalAuth", "resolveCurrentUser");
        const state = await read(this);
        return loadUserData(toUserData(state.accounts.find(account => account.key === state.session?.key), this._createUserData), this.database);
    }

    async signOut() {
        await delay("LocalAuth", "signOut");
        const state = await read(this);
        state.session = null;
        state.redirect = null;
        await write(this, state);
    }

    async signInWithPopup(provider, options) {
        super.signInWithPopup(provider, options);
        await delay("LocalAuth", "signInWithPopup");
        const state = await read(this);
        return login(this, state, providerAccount(state, provider), this._createUserData);
    }

    async signInWithCredential(credential) {
        super.signInWithCredential(credential);
        return signInWithCredential(this, credential, this._createUserData);
    }

    async signInWithRedirect(provider, options) {
        super.signInWithRedirect(provider, options);
        await delay("LocalAuth", "signInWithRedirect");
        const state = await read(this);
        const account = providerAccount(state, provider);
        state.redirect = account.key;
        await login(this, state, account, this._createUserData);
    }

    async resolveRedirectResult() {
        await delay("LocalAuth", "resolveRedirectResult");
        const state = await read(this);
        if (!state.redirect) return null;
        const account = state.accounts.find(item => item.key === state.redirect);
        const previousRevision = state.revision;
        const user = await loadUserData(toUserData(account, this._createUserData), this.database);
        if ((await read(this)).revision !== previousRevision) {
            fail("auth/state-changed", "Local authentication changed while resolving redirect.");
        }
        state.redirect = null;
        await write(this, state);
        return user;
    }

    async sendEmailVerification(options) {
        super.sendEmailVerification(options);
        await delay("LocalAuth", "sendEmailVerification");
        const state = await read(this);
        const account = current(this, state);
        await this._saveProfile({id: account.key}, {public: {emailVerified: true}});
        account.emailVerified = true;
        recordMail(state, "verification", account.email, emailOptions(options));
        await write(this, state);
    }

    async sendPasswordResetEmail(email, options) {
        super.sendPasswordResetEmail(email, options);
        await delay("LocalAuth", "sendPasswordResetEmail");
        email = normalizeEmail(email);
        const state = await read(this);
        if (!state.accounts.some(account => account.email === email)) fail("auth/user-not-found", "Account not found.");
        recordMail(state, "password-reset", email, emailOptions(options));
        await write(this, state);
    }

    async sendSignInLinkToEmail(email, options) {
        super.sendSignInLinkToEmail(email, options);
        await delay("LocalAuth", "sendSignInLinkToEmail");
        email = normalizeEmail(email);
        const state = await read(this);
        if (!state.links.some(link => link.email === email)) state.links.push({key: identifier(), email});
        recordMail(state, "sign-in", email, emailOptions(options, email));
        await write(this, state);
    }

    async checkSignInWithEmailLink() {
        await delay("LocalAuth", "checkSignInWithEmailLink");
        return (await read(this)).links.length > 0;
    }

    async signInWithEmailLink(email) {
        super.signInWithEmailLink(email);
        return signInWithEmailLink(this, email, this._createUserData);
    }

    async updatePassword(password) {
        super.updatePassword(password);
        await changePassword(this, password);
    }

    async updateProfile(fields) {
        super.updateProfile(fields);
        return updateProfile(this, fields);
    }
}
