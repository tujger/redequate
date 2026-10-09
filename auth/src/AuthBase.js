const notImplemented = method => {
    throw new Error(`Not implemented: ${method}`);
};

export default class AuthBase {
    async checkSignInWithEmailLink() {
        return notImplemented("checkSignInWithEmailLink");
    }

    async createUserWithEmailAndPassword(email, password) {
        return notImplemented("createUserWithEmailAndPassword");
    }

    async onAuthStateChanged(callback, onError) {
        return notImplemented("onAuthStateChanged");
    }

    async resolveRedirectResult() {
        return notImplemented("resolveRedirectResult");
    }

    async resolveCurrentUser() {
        return notImplemented("resolveCurrentUser");
    }

    async sendEmailVerification(options) {
        return notImplemented("sendEmailVerification");
    }

    async sendPasswordResetEmail(email, options) {
        return notImplemented("sendPasswordResetEmail");
    }

    async sendSignInLinkToEmail(email, options) {
        return notImplemented("sendSignInLinkToEmail");
    }

    async signInWithEmailAndPassword(email, password) {
        return notImplemented("signInWithEmailAndPassword");
    }

    async signInWithPopup(provider, options) {
        return notImplemented("signInWithPopup");
    }

    async signInWithRedirect(provider, options) {
        return notImplemented("signInWithRedirect");
    }

    async signInWithCredential(token) {
        return notImplemented("signInWithCredential");
    }

    async signInWithEmailLink(email) {
        return notImplemented("signInWithEmailLink");
    }

    async signOut() {
        return notImplemented("signOut");
    }

    async updatePassword(password) {
        return notImplemented("updatePassword");
    }

    async updateProfile({...fields}) {
        return notImplemented("updateProfile");
    }
}
