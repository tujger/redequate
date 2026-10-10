import {delay, fail} from "../../../_common/src/_packages";
import {changeEvent, read, toUserData} from "./common";

export default async function onAuthStateChanged(auth, callback, onError) {
    await delay("LocalTestAuth", "onAuthStateChanged");
    if (typeof callback !== "function" || (onError !== undefined && typeof onError !== "function")) {
        fail("auth/invalid-argument", "Auth state listeners must be functions.");
    }
    const reportError = error => {
        try {
            if (onError) onError(error);
            else console.error("[LocalTestAuth] Auth state observer failed", error);
        } catch (callbackError) {
            console.error("[LocalTestAuth] Auth error callback failed", callbackError);
        }
    };
    let previous;
    let active = true;
    const notify = () => {
        if (!active) return;
        let user;
        try {
            const state = read(auth);
            user = toUserData(state.accounts.find(account => account.uid === state.session?.uid));
        } catch (error) {
            reportError(error);
            return;
        }
        const signature = JSON.stringify(user ? {id: user.id, public: user.public} : null);
        if (signature === previous) return;
        previous = signature;
        try {
            const pending = callback(user);
            if (pending && typeof pending.then === "function") {
                Promise.resolve(pending).catch(reportError);
            }
        } catch (error) {
            reportError(error);
        }
    };
    read(auth);
    const localChange = event => {
        if (event.detail === auth.storageKey) notify();
    };
    const storageChange = event => {
        if (event.storageArea === window.localStorage && (event.key === auth.storageKey || event.key === null)) notify();
    };
    window.addEventListener(changeEvent, localChange);
    window.addEventListener("storage", storageChange);
    notify();
    return () => {
        active = false;
        window.removeEventListener(changeEvent, localChange);
        window.removeEventListener("storage", storageChange);
    };
}
