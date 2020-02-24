import React from 'react';
import * as serviceWorker from "../serviceWorker";
import {pushNotificationsSnackbarNotify} from "./PushNotifications";

export const serviceWorkerRegister = () => {
    serviceWorker.register({
        skipWaiting: true,
        onUpdate: registration => {
            if (registration && registration.waiting) {
                pushNotificationsSnackbarNotify({
                    buttonLabel: "Update",
                    priority: "high",
                    title: "New version available",
                    onButtonClick: () => {
                        registration.waiting.postMessage({type: 'SKIP_WAITING'});
                        window.location.reload();
                    }
                });
            }
        },
        onInit: registration => {
            if (registration && registration.waiting) {
                pushNotificationsSnackbarNotify({
                    buttonLabel: "Activate",
                    priority: "high",
                    title: "New version available",
                    onButtonClick: () => {
                        registration.waiting.postMessage({type: 'SKIP_WAITING'});
                        window.location.reload();
                    }
                });
            }
        },
    });
};
