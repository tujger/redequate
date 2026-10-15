import {fail} from "../../../common";

export const defaultStorageKey = "redequate:messaging:local-test";
export const messageType = "redequate:messaging:local-test:message";

export const validateStorageKey = storageKey => {
    if (typeof storageKey !== "string" || !storageKey.trim()) {
        fail("messaging/invalid-argument", "storageKey must be a non-empty string.");
    }
};

export const isMessage = message => Boolean(message && typeof message === "object" && !Array.isArray(message));

export const sendMessage = (message, storageKey = defaultStorageKey) => {
    validateStorageKey(storageKey);
    if (!isMessage(message)) {
        fail("messaging/invalid-argument", "Message must be an object.");
    }
    window.postMessage({type: messageType, storageKey, message}, window.location.origin);
};
