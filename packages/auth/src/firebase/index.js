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
    updatePassword,
    updateProfile
} from "firebase/auth";
import {fail, UserData} from "../../../common";
import AuthBase from "../AuthBase";
import {toUserData} from "./toUserData";
import loadUserData from "../loadUserData";

export default class FirebaseAuth extends AuthBase {
    _auth = undefined;
    #UserData;

    constructor({firebase, database, UserData: Component = UserData}) {
        super();
        this._auth = getAuth(firebase.app);
        this.#UserData = Component;
        this.database = database;
    }

    userData(user) {
        return loadUserData(toUserData(user, this.#UserData, this.database), this.database);
    }

    currentUser() {
        const user = this._auth.currentUser;
        if (!user) {
            fail("auth/no-current-user", "An authenticated user is required.");
        }
        return user;
    }

    async checkSignInWithEmailLink() {
        return isSignInWithEmailLink(this._auth, window.location.href)
    }

    async createUserWithEmailAndPassword(email, password) {
        return createUserWithEmailAndPassword(this._auth, email, password)
            .then(result => this.userData(result?.user));
    }

    async onAuthStateChanged(callback, onError) {
        if (!(callback instanceof Function) || (onError !== undefined && !(onError instanceof Function))) {
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
        let sequence = 0;
        let active = true;
        const unsubscribe = onAuthStateChanged(this._auth, user => {
            const current = ++sequence;
            try {
                const result = this.userData(user);
                const deliver = loaded => {
                    if (active && current === sequence) return callback(loaded);
                };
                const pending = result && result.then instanceof Function ? result.then(deliver) : deliver(result);
                if (pending && pending.then instanceof Function) pending.catch(reportError);
            } catch (error) {
                reportError(error);
            }
        }, reportError);
        return () => {
            active = false;
            unsubscribe();
        };
    }

    async resolveCurrentUser() {
        await this._auth.authStateReady();
        const user = this._auth.currentUser;
        return this.userData(user);
    }

    async resolveRedirectResult() {
        return getRedirectResult(this._auth)
            .then(result => result?.user ? this.userData(result.user) : null);
    }

    async sendEmailVerification(options) {
        return sendEmailVerification(this.currentUser());
    }

    async sendPasswordResetEmail(email, options) {
        return sendPasswordResetEmail(this._auth, email);
    }

    async sendSignInLinkToEmail(email, options) {
        const actionCodeSettings = {
            url: window.location.origin + "/signup/" + email,
            handleCodeInApp: true,
        };
        return sendSignInLinkToEmail(this._auth, email, actionCodeSettings)
    }

    async signInWithCredential(token) {
        const credential = GoogleAuthProvider.credential(token);
        return signInWithCredential(this._auth, credential)
            .then(result => this.userData(result?.user));
    }

    async signInWithEmailAndPassword(email, password) {
        return signInWithEmailAndPassword(this._auth, email, password)
            .then(result => this.userData(result?.user));
    }

    async signInWithEmailLink(email) {
        return signInWithEmailLink(this._auth, email, window.location.href)
            .then(result => this.userData(result?.user));
    }

    async signInWithPopup(provider, options) {
        return signInWithPopup(this._auth, this.provider(provider))
            .then(result => this.userData(result?.user));
    }

    async signInWithRedirect(provider, options) {
        return signInWithRedirect(this._auth, this.provider(provider))
    }

    async signOut() {
        return signOut(this._auth);
    }

    async updatePassword(password) {
        return updatePassword(this.currentUser(), password)
    }

    async updateProfile({...fields}) {
        return updateProfile(this.currentUser(), {...fields});
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
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({prompt: "select_account"});
        provider.addScope("https://www.googleapis.com/auth/userinfo.email");
        return provider;
    }

    providerFacebook() {
        const provider = new FacebookAuthProvider();
        provider.addScope("email");
        provider.setCustomParameters({prompt: "select_account"});
        return provider;
    }
}
