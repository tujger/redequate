import {delay, fail} from "../../../common";
import {changeEvent, read, toUserData} from "./common";
import loadUserData from "../loadUserData";

export default async function onAuthStateChanged(auth, callback, onError, UserData) {
    await delay("LocalAuth", "onAuthStateChanged");
    if (!(callback instanceof Function) || (onError !== undefined && !(onError instanceof Function))) {
        fail("auth/invalid-argument", "Auth state listeners must be functions.");
    }
    const reportError = error => {
        try {
            if (onError) onError(error);
            else console.error("[LocalAuth] Auth state observer failed", error);
        } catch (callbackError) {
            console.error("[LocalAuth] Auth error callback failed", callbackError);
        }
    };
    let previous;
    let active = true;
    const notify = () => {
        if (!active) return;
        let user;
        try {
            const state = read(auth);
            user = toUserData(state.accounts.find(account => account.uid === state.session?.uid), UserData, auth.database);
        } catch (error) {
            reportError(error);
            return;
        }
        const signature = JSON.stringify(user ? {id: user.id, public: user.public} : null);
        if (signature === previous) return;
        previous = signature;
        const deliver = loaded => {
            if (!active || signature !== previous) return;
            try {
                const pending = callback(loaded);
                if (pending && pending.then instanceof Function) Promise.resolve(pending).catch(reportError);
            } catch (error) {
                reportError(error);
            }
        };
        try {
            const loaded = loadUserData(user, auth.database);
            if (loaded && loaded.then instanceof Function) loaded.then(deliver).catch(reportError);
            else deliver(loaded);
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
