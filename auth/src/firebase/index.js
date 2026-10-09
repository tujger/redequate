import {UserData} from "../../../_common/src";
import AuthBase from "../AuthBase";

export default class FirebaseAuth extends AuthBase {
    firebase = undefined;

    constructor({firebase}) {
        super();
        this.firebase = firebase;
    }

    from(json) {
        const providerItem = json.providerData[0];
        const provider = providerItem ? providerItem.providerId : "anonymous";
        const emailVerified = json.emailVerified || provider === "google.com" || provider === "facebook.com";
        const parsed = {
            id: json.uid,
            role: null,
            public: {
                name: json.displayName,
                email: json.email || providerItem.email,
                emailVerified,
                image: json.photoURL,
                lastLogin: +json.lastLoginAt,
                provider,
                // created: +json.createdAt,
            },
            requestedTimestamp: new Date(),
            loaded: {
                [UserData.PUBLIC]: true,
                [UserData.NAME]: true,
                [UserData.EMAIL]: true,
                [UserData.IMAGE]: true
            }
        };
        return parsed;
    }

    async checkSignInWithEmailLink() {
        return this.firebase.auth().isSignInWithEmailLink(window.location.href)
    }

    async createUserWithEmailAndPassword(email, password) {
        return this.firebase.auth().createUserWithEmailAndPassword(email, password)
    }

    async onAuthStateChanged(callback, onError) {
        return this.firebase.auth().onAuthStateChanged(callback, onError)
    }

    async resolveCurrentUser() {
        return this.firebase.auth().currentUser;
    }

    async resolveRedirectResult() {
        return this.firebase.auth().getRedirectResult()
    }

    async sendEmailVerification(options) {
        return this.firebase.auth().currentUser.sendEmailVerification();
    }

    async sendPasswordResetEmail(email, options) {
        return this.firebase.auth().sendPasswordResetEmail(email)
    }

    async sendSignInLinkToEmail(email, options) {
        const actionCodeSettings = {
            url: window.location.origin + "/signup/" + email,
            handleCodeInApp: true,
        };
        return this.firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings);
    }

    async signInWithCredential(token) {
        const credential = this.firebase.auth.GoogleAuthProvider.credential(token);
        return this.firebase.auth().signInWithCredential(credential)
    }

    async signInWithEmailAndPassword(email, password) {
        return this.firebase.auth().signInWithEmailAndPassword(email, password)
    }

    async signInWithEmailLink(email) {
        return this.firebase.auth().signInWithEmailLink(email, window.location.href);
    }

    async signInWithPopup(provider, options) {
        return this.firebase.auth().signInWithPopup(this.provider(provider))
    }

    async signInWithRedirect(provider, options) {
        return this.firebase.auth().signInWithRedirect(this.provider(provider));
    }

    async signOut() {
        return this.firebase.auth().signOut()
    }

    async updateProfile({...fields}) {
        return this.firebase.auth().currentUser.updateProfile({
            ...fields
        })
    }

    provider(provider) {
        if(provider === "google.com") {
            provider = this.providerGoogle();
        } else if(provider === "facebook.com") {
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
