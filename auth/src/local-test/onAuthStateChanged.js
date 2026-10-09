import {changeEvent, fail, delay, read, createUser} from "./common";

export default async function onAuthStateChanged(auth, callback, onError) {
    await delay("onAuthStateChanged");
    if (typeof callback !== "function" || (onError !== undefined && typeof onError !== "function")) {
        fail("invalid-argument", "Auth state listeners must be functions.");
    }
    let previous;
    let active = true;
    const reportError = error => {
        try {
            if (onError) onError(error);
            else console.error("[LocalTestAuth] Auth state observer failed", error);
        } catch (callbackError) {
            console.error("[LocalTestAuth] Auth error callback failed", callbackError);
        }
    };
    const notify = () => {
        if (!active) return;
        let user;
        try {
            const state = read(auth);
            user = createUser(auth, state.accounts.find(account => account.uid === state.session?.uid));
        } catch (error) {
            reportError(error);
            return;
        }
        const signature = JSON.stringify(user?.toJSON() || null);
        if (signature === previous) return;
        previous = signature;
        try {
            callback(user);
        } catch (error) {
            reportError(error);
        }
    };
    // Fail subscription setup explicitly if persistence cannot be read.
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
