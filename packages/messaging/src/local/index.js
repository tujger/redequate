import {delay, fail} from "../../../common";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import MessagingBase from "../MessagingBase";
import {isMessage, messageType, sendMessage, validateStorageId} from "./common";
import {deleteToken, readToken, subscribeToken} from "./database";

// Local simulation only
export default class LocalMessaging extends MessagingBase {
    constructor({storageId = LOCAL_DATABASE_NAME} = {}) {
        super();
        validateStorageId(storageId);
        this.storageId = storageId;
        window.redequateMessaging ??= {};
        window.redequateMessaging.send ??= sendMessage;
    }

    async addMessageListener(onMessage) {
        if (!(onMessage instanceof Function)) {
            fail("messaging/invalid-argument", "Message listener must be a function.");
        }
        await delay("LocalMessaging", "addMessageListener");
        let active = true;
        const listener = event => {
            if (!active || event.origin !== window.location.origin || event.data?.type !== messageType ||
                event.data.storageId !== this.storageId || !isMessage(event.data.message)) return;
            try {
                deliverMessage({
                    storageId: this.storageId,
                    message: window.structuredClone(event.data.message),
                    onMessage, isActive: () => active
                }).catch(reportError);
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
            active = false;
            window.removeEventListener("message", windowListener);
            serviceWorker?.removeEventListener("message", listener);
        };
    }

    async checkIfSubscribed() {
        return Boolean(await readToken(this.storageId));
    }

    async subscribe() {
        await delay("LocalMessaging", "subscribe");
        return subscribeToken(this.storageId);
    }

    async unsubscribe() {
        await delay("LocalMessaging", "unsubscribe");
        await deleteToken(this.storageId);
    }
}

const deliverMessage = async ({storageId, message, onMessage, isActive}) => {
    const token = await readToken(storageId);
    if (token && isActive()) await onMessage(message);
};

const reportError = error => console.error("[LocalMessaging] Message handler failed", error);
