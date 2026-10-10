import {fail, delay, read, login, providerAccount} from "./common";

export default async function signInWithCredential(auth, credential) {
    await delay("signInWithCredential");
    if (!credential || (typeof credential === "string" && !credential.trim()) ||
        (typeof credential !== "string" && typeof credential !== "object")) {
        fail("invalid-credential", "A simulated credential is required.");
    }
    const state = read(auth);
    return login(auth, state, providerAccount(state,
        typeof credential === "string" ? "google.com" : credential.provider || credential.providerId));
}
