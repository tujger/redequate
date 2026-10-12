import {deleteToken, getMessaging, getToken, isSupported, onMessage as onFirebaseMessage} from "firebase/messaging";
import {fail} from "../../../common/src/_packages";
import MessagingBase from "../MessagingBase";

export default class FirebaseMessaging extends MessagingBase {
    _firebase = undefined;
    _registration = undefined;
    _tokenInitialized = false;

    constructor({firebase, storageKey = "notification-token", serviceWorkerURL, serviceWorkerType = "module"}) {
        super();
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            fail("messaging/invalid-argument", "storageKey must be a non-empty string.");
        }
        if (serviceWorkerURL !== undefined && (typeof serviceWorkerURL !== "string" || !serviceWorkerURL.trim())) {
            fail("messaging/invalid-argument", "serviceWorkerURL must be a non-empty string.");
        }
        if (!["classic", "module"].includes(serviceWorkerType)) {
            fail("messaging/invalid-argument", "serviceWorkerType must be classic or module.");
        }
        this.serviceWorkerURL = serviceWorkerURL;
        this.serviceWorkerType = serviceWorkerType;
        this._firebase = firebase;
        this.storageKey = storageKey;
    }

    async addMessageListener(onMessage) {
        if (typeof onMessage !== "function") {
            fail("messaging/invalid-argument", "Message listener must be a function.");
        }
        return onFirebaseMessage(await resolveFirebaseMessaging(this._firebase), payload => {
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
        const messaging = await resolveFirebaseMessaging(this._firebase);
        const permission = await window.Notification.requestPermission();
        if (permission !== "granted") {
            throw new Error("Notifications denied");
        }
        const token = await this._getToken(messaging);
        window.localStorage.setItem(this.storageKey, token);
        return token;
    }

    async unsubscribe() {
        const messaging = await resolveFirebaseMessaging(this._firebase);
        if (this.serviceWorkerURL && !this._tokenInitialized) {
            if (window.Notification.permission !== "granted") {
                fail("messaging/permission-blocked", "Notification permission is required to remove the Firebase token.");
            }
            // getToken is the public SDK API for binding a custom registration.
            await this._getToken(messaging);
        }
        const result = await deleteToken(messaging);
        this._tokenInitialized = false;
        window.localStorage.removeItem(this.storageKey);
        return result;
    }

    async _getToken(messaging) {
        const options = this.serviceWorkerURL
            ? {serviceWorkerRegistration: await this._resolveServiceWorkerRegistration()}
            : undefined;
        const token = await getToken(messaging, options);
        this._tokenInitialized = true;
        return token;
    }

    _resolveServiceWorkerRegistration() {
        if (!this._registration) {
            this._registration = navigator.serviceWorker.register(this.serviceWorkerURL, {
                type: this.serviceWorkerType,
                scope: "/firebase-cloud-messaging-push-scope",
            }).then(async registration => {
                await waitForActiveWorker(registration);
                return registration;
            }).catch(error => {
                this._registration = undefined;
                fail("messaging/failed-service-worker-registration", error.message);
            });
        }
        return this._registration;
    }
}

const resolveFirebaseMessaging = async firebase => {
    if (!await isSupported()) {
        fail("messaging/unsupported-browser", "This browser doesn't support Firebase Messaging");
    }
    return getMessaging(firebase.app);
};

const waitForActiveWorker = registration => {
    if (registration.active) return Promise.resolve();
    const worker = registration.installing || registration.waiting;
    if (!worker) return Promise.reject(new Error("No Firebase Messaging worker is available."));
    return new Promise((resolve, reject) => {
        const finish = error => {
            clearTimeout(timeout);
            worker.removeEventListener("statechange", onStateChanged);
            if (error) reject(error);
            else resolve();
        };
        const onStateChanged = () => {
            if (worker.state === "activated") finish();
            else if (worker.state === "redundant") finish(new Error("Firebase Messaging worker installation failed."));
        };
        const timeout = setTimeout(() => finish(new Error("Firebase Messaging worker activation timed out.")), 10000);
        worker.addEventListener("statechange", onStateChanged);
        onStateChanged();
    });
};
