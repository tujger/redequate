const notImplemented = method => {
    throw new Error(`Not implemented: ${method}`);
};

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
