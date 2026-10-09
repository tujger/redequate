import AuthBase from "../AuthBase";
import {createAuthUser} from "../common";

export default class FirebaseAuth extends AuthBase {
    firebase = undefined;

    constructor({firebase}) {
        super();
        this.firebase = firebase;
    }

    from(user) {
        if(!user) return null;

        const json = typeof user?.toJSON === "function" ? user.toJSON() : user;
        const providerItem = json?.providerData?.[0];
        const provider = providerItem?.providerId || "anonymous";
        return createAuthUser({
            id: json?.uid,
            name: json?.displayName,
            email: json?.email || providerItem?.email,
            verified: json?.emailVerified || provider === "google.com" || provider === "facebook.com",
            image: json?.photoURL,
            provider,
            created: json?.createdAt,
            lastLogin: json?.lastLoginAt,
        });
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
        const result = await this.firebase.auth().createUserWithEmailAndPassword(email, password);
        return this.from(result.user);
    }

    async onAuthStateChanged(callback, onError) {
        return this.firebase.auth().onAuthStateChanged(user => {
            return callback(this.from(user));
        }, onError)
    }

    async resolveCurrentUser() {
            const user = this.firebase.auth().currentUser;
            return  this.from(user);
    }

    async resolveRedirectResult() {
            const result = await this.firebase.auth().getRedirectResult();
            return this.from(result.user);
    }

    async resolveToken(forceRefresh = false) {
            const user = this.firebase.auth().currentUser;
            return  user?.getIdToken(forceRefresh);
    }

    async sendEmailVerification(options) {
        await this.operation(() => this.currentUser().sendEmailVerification());
    }

    async sendPasswordResetEmail(email, options) {
        await this.operation(() => this.firebase.auth().sendPasswordResetEmail(email));
    }

    async sendSignInLinkToEmail(email, options) {
        const actionCodeSettings = {
            url: window.location.origin + "/signup/" + email,
            handleCodeInApp: true,
        };
        await this.firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
    }

    async signInWithCredential(token) {
            const credential = this.firebase.auth.GoogleAuthProvider.credential(token);
            const result = await this.firebase.auth().signInWithCredential(credential);
            return this.from(result.user);
    }

    async signInWithEmailAndPassword(email, password) {
            const result = await this.firebase.auth().signInWithEmailAndPassword(email, password);
            return this.from(result.user);
    }

    async signInWithEmailLink(email) {
            const result = await this.firebase.auth().signInWithEmailLink(email, window.location.href);
            return this.from(result.user);
    }

    async signInWithPopup(provider, options) {
            const result = await this.firebase.auth().signInWithPopup(this.provider(provider));
            return this.from(result.user);
    }

    async signInWithRedirect(provider, options) {
        return this.firebase.auth().signInWithRedirect(this.provider(provider))
    }

    async signOut() {
        return this.firebase.auth().signOut()
    }

    async updatePassword(password) {
        return this.currentUser().updatePassword(password)
    }

    async updateProfile({...fields}) {
        return this.firebase.auth().currentUser.updateProfile({
            ...fields
        })
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
