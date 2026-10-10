import {delay, fail} from "../../../_common/src/_packages";
import {read, login, providerAccount} from "./common";

export default async function signInWithCredential(auth, credential) {
    await delay("LocalTestAuth", "signInWithCredential");
    if (!credential || (typeof credential === "string" && !credential.trim()) ||
        (typeof credential !== "string" && typeof credential !== "object")) {
        fail("auth/invalid-credential", "A simulated credential is required.");
    }
    const state = read(auth);
    return login(auth, state, providerAccount(state,
        typeof credential === "string" ? "google.com" : credential.provider || credential.providerId));
}
