import AuthBase from "../AuthBase";
import {UserData} from "../../../_common/src";

export default class FirebaseAuth extends AuthBase {
    firebase = undefined;

    constructor({firebase}) {
        super();
        this.firebase = firebase;
    }

    currentUser() {
        const user = this.firebase.auth().currentUser;
        if (!user) {
            throw Object.assign(new Error("An authenticated user is required."), {code: "auth/no-current-user"});
        }
        return user;
    }

    async checkSignInWithEmailLink() {
        return this.firebase.auth().isSignInWithEmailLink(window.location.href)
    }

    async createUserWithEmailAndPassword(email, password) {
        return this.firebase.auth()
            .createUserWithEmailAndPassword(email, password)
            .then(result => toUserData(result?.user));
    }

    async onAuthStateChanged(callback, onError) {
        if (typeof callback !== "function" || (onError !== undefined && typeof onError !== "function")) {
            throw Object.assign(new Error("Auth state listeners must be functions."), {code: "auth/invalid-argument"});
        }
        const reportError = error => {
            try {
                if (onError) onError(error);
                else console.error("[FirebaseAuth] Auth state observer failed", error);
            } catch (callbackError) {
                console.error("[FirebaseAuth] Auth error callback failed", callbackError);
            }
        };
        return this.firebase.auth().onAuthStateChanged(user => {
            try {
                const pending = callback(user ? toUserData(user) : null);
                if (pending && typeof pending.then === "function") pending.catch(reportError);
            } catch (error) {
                reportError(error);
            }
        }, reportError);
    }

    async resolveCurrentUser() {
        const user = this.firebase.auth().currentUser;
        return toUserData(user);
    }

    async resolveRedirectResult() {
        return this.firebase.auth()
            .getRedirectResult()
            .then(result => toUserData(result?.user));
    }

    async resolveToken(forceRefresh = false) {
        const user = this.firebase.auth().currentUser;
        return user?.getIdToken(forceRefresh);
    }

    async sendEmailVerification(options) {
        return this.currentUser().sendEmailVerification();
    }

    async sendPasswordResetEmail(email, options) {
        return this.firebase.auth().sendPasswordResetEmail(email);
    }

    async sendSignInLinkToEmail(email, options) {
        const actionCodeSettings = {
            url: window.location.origin + "/signup/" + email,
            handleCodeInApp: true,
        };
        return this.firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
    }

    async signInWithCredential(token) {
        const credential = this.firebase.auth.GoogleAuthProvider.credential(token);
        return this.firebase.auth()
            .signInWithCredential(credential)
            .then(result => toUserData(result?.user));
    }

    async signInWithEmailAndPassword(email, password) {
        return this.firebase.auth()
            .signInWithEmailAndPassword(email, password)
            .then(result => toUserData(result?.user));
    }

    async signInWithEmailLink(email) {
        return this.firebase.auth()
            .signInWithEmailLink(email, window.location.href)
            .then(result => toUserData(result?.user));
    }

    async signInWithPopup(provider, options) {
        return this.firebase.auth()
            .signInWithPopup(this.provider(provider))
            .then(result => toUserData(result?.user));
    }

    async signInWithRedirect(provider, options) {
        return this.firebase.auth().signInWithRedirect(this.provider(provider))
    }

    async signOut() {
        return this.firebase.auth().signOut();
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
        const provider = new this.firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({prompt: "select_account"});
        provider.addScope("https://www.googleapis.com/auth/userinfo.email");
        return provider;
    }

    providerFacebook() {
        const provider = new this.firebase.auth.FacebookAuthProvider();
        provider.addScope("email");
        provider.setCustomParameters({prompt: "select_account"});
        return provider;
    }
}

const toUserData = user => {
    if(!user) return null;
    const json = user.toJSON();
    if (!json.uid) {
        throw Object.assign(new Error("Auth user has no identifier."), {code: "auth/invalid-user-data"});
    }
    const providerItem = json.providerData?.[0];
    const provider = providerItem?.providerId || "anonymous";
    const timestamp = value => {
        const number = Number(value);
        return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number : null;
    };
    return new UserData().fromJSON({
        id: json.uid,
        role: null,
        public: {
            name: json.displayName ?? null,
            email: json.email || providerItem?.email || null,
            emailVerified: Boolean(json.emailVerified || provider === "google.com" || provider === "facebook.com"),
            image: json.photoURL ?? null,
            provider,
            created: timestamp(json.createdAt) ?? Date.now(),
            lastLogin: timestamp(json.lastLoginAt),
        },
        private: {},
        requested: Date.now(),
        loaded: {public: true, name: true, email: true, image: true},
    });
};
