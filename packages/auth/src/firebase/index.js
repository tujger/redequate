import {
    getAuth,
    isSignInWithEmailLink,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    getRedirectResult,
    sendEmailVerification,
    sendPasswordResetEmail,
    sendSignInLinkToEmail,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithCredential,
    signInWithEmailAndPassword,
    signInWithEmailLink,
    signInWithPopup,
    signInWithRedirect,
    signOut,
    updatePassword
} from "firebase/auth";
import AuthBase from "../AuthBase";
import observeAuthState from "../common/observeAuthState";
import saveCurrentProfile from "../common/saveCurrentProfile";
import loadUserData from "../common/loadUserData";
import initialProfile from "../common/initialProfile";
import emailOptions from "../common/emailOptions";
import {toUserData} from "./toUserData";

export default class FirebaseAuth extends AuthBase {
    _auth = undefined;

    constructor(options = {}) {
        super(options);
        this._auth = getAuth(options.firebase.app);
    }

    _userData(user) {
        return loadUserData(toUserData(user, this._createUserData), this.database);
    }

    _currentUser() {
        return this._requireCurrentUser(this._auth.currentUser);
    }

    async checkSignInWithEmailLink() {
        return isSignInWithEmailLink(this._auth, window.location.href)
    }

    async createUserWithEmailAndPassword(email, password) {
        super.createUserWithEmailAndPassword(email, password);
        const result = await createUserWithEmailAndPassword(this._auth, email, password);
        const user = toUserData(result?.user, this._createUserData);
        await this._saveProfile(user, initialProfile(user));
        return loadUserData(user, this.database);
    }

    async onAuthStateChanged(callback, onError) {
        super.onAuthStateChanged(callback, onError);
        return observeAuthState({
            auth: this, callback, onError,
            subscribe: (next, error) => onAuthStateChanged(this._auth, user => {
                try {
                    next(toUserData(user, this._createUserData));
                } catch (failure) {
                    error(failure);
                }
            }, error)
        });
    }

    async resolveCurrentUser(options) {
        super.resolveCurrentUser(options);
        await this._auth.authStateReady();
        const user = this._auth.currentUser;
        return this._userData(user);
    }

    async resolveRedirectResult() {
        return getRedirectResult(this._auth)
            .then(result => result?.user ? this._userData(result.user) : null);
    }

    async sendEmailVerification(options) {
        super.sendEmailVerification(options);
        return sendEmailVerification(this._currentUser(), emailOptions(options));
    }

    async sendPasswordResetEmail(email, options) {
        super.sendPasswordResetEmail(email, options);
        return sendPasswordResetEmail(this._auth, email, emailOptions(options));
    }

    async sendSignInLinkToEmail(email, options) {
        super.sendSignInLinkToEmail(email, options);
        const actionCodeSettings = emailOptions(options, email);
        return sendSignInLinkToEmail(this._auth, email, actionCodeSettings)
    }

    async signInWithCredential(token) {
        super.signInWithCredential(token);
        const credential = GoogleAuthProvider.credential(token);
        return signInWithCredential(this._auth, credential)
            .then(result => this._userData(result?.user));
    }

    async signInWithEmailAndPassword(email, password) {
        super.signInWithEmailAndPassword(email, password);
        return signInWithEmailAndPassword(this._auth, email, password)
            .then(result => this._userData(result?.user));
    }

    async signInWithEmailLink(email) {
        super.signInWithEmailLink(email);
        return signInWithEmailLink(this._auth, email, window.location.href)
            .then(result => this._userData(result?.user));
    }

    async signInWithPopup(provider, options) {
        super.signInWithPopup(provider, options);
        return signInWithPopup(this._auth, this._provider(provider))
            .then(result => this._userData(result?.user));
    }

    async signInWithRedirect(provider, options) {
        super.signInWithRedirect(provider, options);
        return signInWithRedirect(this._auth, this._provider(provider))
    }

    async signOut() {
        return signOut(this._auth);
    }

    async updatePassword(password) {
        super.updatePassword(password);
        return updatePassword(this._currentUser(), password)
    }

    async updateProfile(fields) {
        super.updateProfile(fields);
        await saveCurrentProfile(this, fields);
    }

    _provider(provider) {
        if (provider === "google.com") {
            provider = this._providerGoogle();
        } else if (provider === "facebook.com") {
            provider = this._providerFacebook();
        }
        return provider;
    }

    _providerGoogle() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({prompt: "select_account"});
        provider.addScope("https://www.googleapis.com/auth/userinfo.email");
        return provider;
    }

    _providerFacebook() {
        const provider = new FacebookAuthProvider();
        provider.addScope("email");
        provider.setCustomParameters({prompt: "select_account"});
        return provider;
    }
}
