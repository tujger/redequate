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
                    onButtonClick: () => {
                        registration.waiting.postMessage({type: 'SKIP_WAITING'});
                        window.location.reload();
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });
            }
        },
        onInit: registration => {
            if (registration && registration.waiting) {
                pushNotificationsSnackbarNotify({
                    buttonLabel: "Activate",
                    onButtonClick: () => {
                        registration.waiting.postMessage({type: 'SKIP_WAITING'});
                        window.location.reload();
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });
            }
        },
    });
};
