import {delay, fail, identifier} from "../../../common";
import MessagingBase from "../MessagingBase";
import {defaultStorageKey, isMessage, messageType, sendMessage, validateStorageKey} from "./common";

// Local simulation only
export default class LocalTestMessaging extends MessagingBase {
    constructor({storageKey = defaultStorageKey} = {}) {
        super();
        validateStorageKey(storageKey);
        this.storageKey = storageKey;
        window.redequateMessaging ??= {};
        window.redequateMessaging.send ??= sendMessage;
    }

    async addMessageListener(onMessage) {
        if (typeof onMessage !== "function") {
            fail("messaging/invalid-argument", "Message listener must be a function.");
        }
        await delay("LocalTestMessaging", "addMessageListener");
        const listener = event => {
            if (event.origin !== window.location.origin || event.data?.type !== messageType ||
                event.data.storageKey !== this.storageKey || !isMessage(event.data.message)) return;
            try {
                if (!window.localStorage.getItem(this.storageKey)) return;
                const pending = onMessage(window.structuredClone(event.data.message));
                if (pending && typeof pending.then === "function") {
                    Promise.resolve(pending).catch(reportError);
                }
            } catch (error) {
                reportError(error);
            }
        };
        const windowListener = event => {
            if (event.source === window) listener(event);
        };
        const serviceWorker = window.navigator?.serviceWorker;
        window.addEventListener("message", windowListener);
        serviceWorker?.addEventListener("message", listener);
        return () => {
            window.removeEventListener("message", windowListener);
            serviceWorker?.removeEventListener("message", listener);
        };
    }

    async checkIfSubscribed() {
        return Boolean(window.localStorage.getItem(this.storageKey));
    }

    async subscribe() {
        await delay("LocalTestMessaging", "subscribe");
        let token = window.localStorage.getItem(this.storageKey);
        if (!token) {
            token = identifier();
            window.localStorage.setItem(this.storageKey, token);
        }
        return token;
    }

    async unsubscribe() {
        await delay("LocalTestMessaging", "unsubscribe");
        window.localStorage.removeItem(this.storageKey);
    }
}

const reportError = error => console.error("[LocalTestMessaging] Message handler failed", error);
