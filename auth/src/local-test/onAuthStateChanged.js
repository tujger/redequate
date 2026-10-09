import {changeEvent, fail, delay, read, toUserData} from "./common";

export default async function onAuthStateChanged(auth, callback, onError) {
    await delay("onAuthStateChanged");
    if (typeof callback !== "function" || (onError !== undefined && typeof onError !== "function")) {
        fail("invalid-argument", "Auth state listeners must be functions.");
    }
    let previous;
    let active = true;
    const notify = () => {
        if (!active) return;
        let user;
        try {
            const state = read(auth);
            user = toUserData(state.accounts.find(account => account.uid === state.session?.uid));
        } catch (error) {
            onError(error);
            return;
        }
        const signature = JSON.stringify(user ? {id: user.id, public: user.public} : null);
        if (signature === previous) return;
        previous = signature;
        try {
            return callback(user);
        } catch (error) {
            onError(error);
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
