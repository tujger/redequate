import {delay, fail} from "../../../common";
import {read, login, providerAccount} from "./common";

export default async function signInWithCredential(auth, credential, createUserData) {
    await delay("LocalAuth", "signInWithCredential");
    if (typeof credential === "string" && !credential.trim()) {
        fail("auth/invalid-credential", "A simulated credential is required.");
    }
    const state = await read(auth);
    return login(auth, state, providerAccount(state,
        typeof credential === "string" ? "google.com" : credential.provider || credential.providerId), createUserData);
}
