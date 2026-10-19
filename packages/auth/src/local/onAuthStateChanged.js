import {delay} from "../../../common";
import {changeEvent, channelName, read, toUserData} from "./common";

export default async function onAuthStateChanged(auth, callback, onError, createUserData) {
    await delay("LocalAuth", "onAuthStateChanged");
    await read(auth);
    let active = true;
    let sequence = 0;
    const notify = async () => {
        const current = ++sequence;
        try {
            const state = await read(auth);
            if (active && current === sequence) callback(toUserData(state.accounts.find(account => account.key === state.session?.key), createUserData));
        } catch (error) {
            if (active && current === sequence) onError(error);
        }
    };
    const localChange = event => {
        if (event.detail === auth.storageKey) notify();
    };
    const channel = globalThis.BroadcastChannel ? new globalThis.BroadcastChannel(channelName) : null;
    if (channel) channel.onmessage = event => {
        if (event.data?.namespace === auth.storageKey) notify();
    };
    window.addEventListener(changeEvent, localChange);
    await notify();
    return () => {
        active = false;
        window.removeEventListener(changeEvent, localChange);
        channel?.close();
    };
}
