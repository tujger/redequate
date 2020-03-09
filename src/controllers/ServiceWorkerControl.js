import React from 'react';
import * as serviceWorker from "../serviceWorker";
import {notifySnackbar} from "./Notifications";
import {_firebase} from "./Firebase";

const activate = registration => {
    registration.waiting.postMessage({type: 'SKIP_WAITING'});
    window.location.reload();
    try {
        console.log("FB-SW updating");
        _firebase.messaging().swRegistration.update().then(reg => {
            console.log("FB-SW updated", reg);
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
