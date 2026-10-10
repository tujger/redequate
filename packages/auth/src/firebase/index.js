import {fail} from "../../../_common/src/_packages";
import AuthBase from "../AuthBase";
import {toUserData} from "./toUserData";

export default class FirebaseAuth extends AuthBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

    currentUser() {
        const user = this._firebase.auth().currentUser;
        if (!user) {
            fail("auth/no-current-user", "An authenticated user is required.");
        }
        return user;
    }

    async checkSignInWithEmailLink() {
        return this._firebase.auth().isSignInWithEmailLink(window.location.href)
    }

    async createUserWithEmailAndPassword(email, password) {
        return this._firebase.auth()
            .createUserWithEmailAndPassword(email, password)
            .then(result => toUserData(result?.user));
    }

    async onAuthStateChanged(callback, onError) {
        if (typeof callback !== "function" || (onError !== undefined && typeof onError !== "function")) {
            fail("auth/invalid-argument", "Auth state listeners must be functions.");
        }
        const reportError = error => {
            try {
                if (onError) onError(error);
                else console.error("[FirebaseAuth] Auth state observer failed", error);
            } catch (callbackError) {
                console.error("[FirebaseAuth] Auth error callback failed", callbackError);
            }
        };
        return this._firebase.auth().onAuthStateChanged(user => {
            try {
                const pending = callback(user ? toUserData(user) : null);
                if (pending && typeof pending.then === "function") pending.catch(reportError);
            } catch (error) {
                reportError(error);
            }
        }, reportError);
    }

    async resolveCurrentUser() {
        const user = this._firebase.auth().currentUser;
        return toUserData(user);
    }

    async resolveRedirectResult() {
        return this._firebase.auth()
            .getRedirectResult()
            .then(result => toUserData(result?.user));
    }

    async sendEmailVerification(options) {
        return this.currentUser().sendEmailVerification();
    }

    async sendPasswordResetEmail(email, options) {
        return this._firebase.auth().sendPasswordResetEmail(email);
    }

    async sendSignInLinkToEmail(email, options) {
        const actionCodeSettings = {
            url: window.location.origin + "/signup/" + email,
            handleCodeInApp: true,
        };
        return this._firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
    }

    async signInWithCredential(token) {
        const credential = this._firebase.auth.GoogleAuthProvider.credential(token);
        return this._firebase.auth()
            .signInWithCredential(credential)
            .then(result => toUserData(result?.user));
    }

    async signInWithEmailAndPassword(email, password) {
        return this._firebase.auth()
            .signInWithEmailAndPassword(email, password)
            .then(result => toUserData(result?.user));
    }

    async signInWithEmailLink(email) {
        return this._firebase.auth()
            .signInWithEmailLink(email, window.location.href)
            .then(result => toUserData(result?.user));
    }

    async signInWithPopup(provider, options) {
        return this._firebase.auth()
            .signInWithPopup(this.provider(provider))
            .then(result => toUserData(result?.user));
    }

    async signInWithRedirect(provider, options) {
        return this._firebase.auth().signInWithRedirect(this.provider(provider))
    }

    async signOut() {
        return this._firebase.auth().signOut();
    }

    async updatePassword(password) {
        return this.currentUser().updatePassword(password)
    }

    async updateProfile({...fields}) {
        return this.currentUser().updateProfile({...fields});
    }

    provider(provider) {
        if (provider === "google.com") {
            provider = this.providerGoogle();
        } else if (provider === "facebook.com") {
            provider = this.providerFacebook();
        }
        return provider;
    }

    providerGoogle() {
        const provider = new this._firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({prompt: "select_account"});
        provider.addScope("https://www.googleapis.com/auth/userinfo.email");
        return provider;
    }

    providerFacebook() {
        const provider = new this._firebase.auth.FacebookAuthProvider();
        provider.addScope("email");
        provider.setCustomParameters({prompt: "select_account"});
        return provider;
    }
}
