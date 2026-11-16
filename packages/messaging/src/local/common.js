import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import {fail} from "../../../common";

export const messageType = "redequate:messaging:local:message";

export const validateStorageId = storageId => {
    if (typeof storageId !== "string" || !storageId.trim()) {
        fail("messaging/invalid-argument", "storageId must be a non-empty string.");
    }
};

export const isMessage = message => Boolean(message && typeof message === "object" && !(message instanceof Array));

export const sendMessage = (message, storageId = LOCAL_DATABASE_NAME) => {
    validateStorageId(storageId);
    if (!isMessage(message)) {
        fail("messaging/invalid-argument", "Message must be an object.");
    }
    window.postMessage({type: messageType, storageId, message}, window.location.origin);
};
