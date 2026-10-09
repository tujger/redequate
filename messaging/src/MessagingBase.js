const notImplemented = method => {
    throw new Error(`Not implemented: ${method}`);
};

export default class MessagingBase {
    async subscribe() {
        return notImplemented("subscribe");
    }

    async unsubscribe() {
        return notImplemented("unsubscribe");
    }

    async onMessage(callback) {
        return notImplemented("onMessage");
    }
}
