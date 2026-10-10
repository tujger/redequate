import {delay, fail, identifier} from "../../../_common/src/_packages";
import MessagingBase from "../MessagingBase";

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
            if (event.detail?.storageKey !== this.storageKey) return;
            try {
                if (!window.localStorage.getItem(this.storageKey)) return;
                const pending = onMessage(window.structuredClone(event.detail.message));
                if (pending && typeof pending.then === "function") {
                    Promise.resolve(pending).catch(reportError);
                }
            } catch (error) {
                reportError(error);
            }
        };
        window.addEventListener(messageEvent, listener);
        return () => window.removeEventListener(messageEvent, listener);
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

const defaultStorageKey = "redequate:messaging:local-test";
const messageEvent = "redequate:messaging:local-test:message";

const validateStorageKey = storageKey => {
    if (typeof storageKey !== "string" || !storageKey.trim()) {
        fail("messaging/invalid-argument", "storageKey must be a non-empty string.");
    }
};

const sendMessage = (message, storageKey = defaultStorageKey) => {
    validateStorageKey(storageKey);
    if (!message || typeof message !== "object" || Array.isArray(message)) {
        fail("messaging/invalid-argument", "Message must be an object.");
    }
    window.dispatchEvent(new window.CustomEvent(messageEvent, {
        detail: {storageKey, message: window.structuredClone(message)}
    }));
};

const reportError = error => console.error("[LocalTestMessaging] Message handler failed", error);
