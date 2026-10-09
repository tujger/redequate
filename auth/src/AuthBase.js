const notImplemented = method => {
    throw new Error(`Not implemented: ${method}`);
};

// Override supported operations; inherited stubs fail explicitly.
// Only operations used by current authentication flows; all return Promises.
export default class AuthBase {
    async onAuthStateChanged(callback, onError) {
        return notImplemented("onAuthStateChanged");
    }

    async signInWithEmailAndPassword(email, password) {
        return notImplemented("signInWithEmailAndPassword");
    }

    async createUserWithEmailAndPassword(email, password) {
        return notImplemented("createUserWithEmailAndPassword");
    }

    async signInWithPopup(provider, options) {
        return notImplemented("signInWithPopup");
    }

    async signInWithRedirect(provider, options) {
        return notImplemented("signInWithRedirect");
    }

    async resolveRedirectResult() {
        return notImplemented("resolveRedirectResult");
    }

    async signInWithCredential(credential) {
        return notImplemented("signInWithCredential");
    }

    async sendSignInLinkToEmail(email, options) {
        return notImplemented("sendSignInLinkToEmail");
    }

    async checkSignInWithEmailLink(url) {
        return notImplemented("checkSignInWithEmailLink");
    }

    async signInWithEmailLink(email, url) {
        return notImplemented("signInWithEmailLink");
    }

    async sendEmailVerification(options) {
        return notImplemented("sendEmailVerification");
    }

    async sendPasswordResetEmail(email, options) {
        return notImplemented("sendPasswordResetEmail");
    }

    async updatePassword(password) {
        return notImplemented("updatePassword");
    }

    async resolveToken(forceRefresh) {
        return notImplemented("resolveToken");
    }

    async signOut() {
        return notImplemented("signOut");
    }
}
