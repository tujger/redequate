import MessagingBase from "../MessagingBase";

export default class FirebaseMessaging extends MessagingBase {
    _firebase = undefined;

    constructor({firebase, storageKey = "notification-token"}) {
        super();
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            throw Object.assign(new Error("storageKey must be a non-empty string."), {
                code: "messaging/invalid-argument"
            });
        }
        this._firebase = firebase;
        this.storageKey = storageKey;
    }

    async addMessageListener(onMessage) {
        if (typeof onMessage !== "function") {
            throw Object.assign(new Error("Message listener must be a function."), {
                code: "messaging/invalid-argument"
            });
        }
        return resolveFirebaseMessaging(this._firebase).onMessage(payload => {
            const data = payload.notification || payload.data || {};
            onMessage({
                ...data,
                from: payload.from,
                image: data.icon,
                priority: payload.priority,
            });
        });
    }

    async checkIfSubscribed() {
        return Boolean(window.localStorage.getItem(this.storageKey));
    }

    async subscribe() {
        // Safari case
        // https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW1
        const messaging = resolveFirebaseMessaging(this._firebase);
        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            throw new Error("Notifications denied");
        }
        const token = await messaging.getToken();
        window.localStorage.setItem(this.storageKey, token);
        return token;
    }

    async unsubscribe() {
        const result = await resolveFirebaseMessaging(this._firebase).deleteToken();
        window.localStorage.removeItem(this.storageKey);
        return result;
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
