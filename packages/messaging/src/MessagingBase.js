import {notImplemented} from "../../_common/src/_packages";

export default class MessagingBase {
    async addMessageListener(onMessage) {
        return notImplemented("addMessageListener");
    }

    async checkIfSubscribed() {
        return notImplemented("checkIfSubscribed");
    }

    async subscribe() {
        return notImplemented("subscribe");
    }

    async unsubscribe() {
        return notImplemented("unsubscribe");
    }
}
