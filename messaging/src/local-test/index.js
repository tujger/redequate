import MessagingBase from "../MessagingBase";

// Local simulation only
export default class LocalTestMessaging extends MessagingBase {
    constructor({storageKey = "redequate:messaging:local-test"} = {}) {
        super();
        if (!storageKey.trim()) {
            throw new Error("storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
    }
}
