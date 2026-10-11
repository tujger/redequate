/* global self, clients */
import {initializeApp} from "firebase/app";
import {getMessaging, onBackgroundMessage} from "firebase/messaging/sw";

export default function initializeFirebaseMessagingWorker(firebaseConfig) {
    self.addEventListener("notificationclick", function (event) {
        console.log("[SW] notification click", event);
        const clickedNotification = event.notification;
        clickedNotification.close();
        const promiseChain = clients
            .matchAll({
                type: "window",
                includeUncontrolled: true
            }).then(windowClients => {
                let matchingClient = null;
                for (let i = 0; i < windowClients.length; i++) {
                    const windowClient = windowClients[i];
                    if (windowClient.url === clickedNotification.tag) {
                        matchingClient = windowClient;
                        break;
                    }
                }
                if (matchingClient) {
                    return matchingClient.focus();
                } else {
                    return clients.openWindow(clickedNotification.tag);
                }
            });
        event.waitUntil(promiseChain);
    });

    const messaging = getMessaging(initializeApp(firebaseConfig));

    onBackgroundMessage(messaging, payload => {
        const {title, ...options} = payload.data || payload.notification;
        console.log("[SW] message", title, JSON.stringify(options));
        return self.registration.showNotification(title, options);
    });
}
