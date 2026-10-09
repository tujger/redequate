import MessagingBase from "../MessagingBase";

export default class FirebaseMessaging extends MessagingBase {
    _firebase = undefined;

    constructor({firebase}) {
        super();
        this._firebase = firebase;
    }

    async subscribe() {
        // Safari case
        // https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW1
        const messaging = resolveFirebaseMessaging(this._firebase);
        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            throw new Error("Notifications denied");
        }
        return messaging.getToken();
    }

    async unsubscribe() {
        return resolveFirebaseMessaging(this._firebase).deleteToken();
    }

    async onMessage(messageHandler) {
        if (typeof messageHandler !== "function") {
            throw Object.assign(new Error("Message listener must be a function."), {
                code: "messaging/invalid-argument"
            });
        }
        return resolveFirebaseMessaging(this._firebase).onMessage(payload => {
            const data = payload.notification || payload.data || {};
            messageHandler({
                ...data,
                from: payload.from,
                image: data.icon,
                priority: payload.priority,
            });
        });
    }
}

const resolveFirebaseMessaging = firebase => {
    if (!firebase.messaging.isSupported()) {
        throw Object.assign(new Error("This browser doesn't support Firebase Messaging"), {
            code: "messaging/unsupported-browser"
        });
    }
    return firebase.messaging();
};
