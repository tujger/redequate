import React from 'react';
import * as serviceWorker from "../serviceWorker";
import {notifySnackbar} from "./Notifications";
import {firebaseMessaging} from "./Firebase";

const activate = registration => {
    registration.waiting.postMessage({type: 'SKIP_WAITING'});
    window.location.reload();
    try {
        console.log("[fb-sw] updating");
        firebaseMessaging.messaging().swRegistration.update().then(reg => {
            console.log("[fb-sw] updated", reg);
        }).catch(console.error);
    } catch(e) {
        console.error(e);
    }
};

export const serviceWorkerRegister = () => {
    serviceWorker.register({
        skipWaiting: true,
        onUpdate: registration => {
            if (registration && registration.waiting) {
              notifySnackbar({
                    buttonLabel: "Update",
                    onButtonClick: () => {
                        activate(registration);
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });
            }
        },
        onInit: registration => {
            if (registration && registration.waiting) {
              notifySnackbar({
                    buttonLabel: "Activate",
                    onButtonClick: () => {
                        activate(registration);
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });
            }
        },
    });
};
