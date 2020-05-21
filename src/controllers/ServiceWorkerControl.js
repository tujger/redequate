import React from "react";
import * as serviceWorker from "../serviceWorker";
import {notifySnackbar} from "./Notifications";
import {firebaseMessaging} from "./Firebase";

const activateUpdate = registration => {
    registration.waiting.postMessage({type: "SKIP_WAITING"});
    window.location.reload();
    try {
        console.log("[fb-sw] updating");
        firebaseMessaging.messaging().swRegistration.update().then(() => {
            console.log("[fb-sw] updated");
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
                       activateUpdate(registration);
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
                       activateUpdate(registration);
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });
            }
        },
    });
};

export const checkForUpdate = () => new Promise((resolve, reject) => {
    if(!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        window.location.reload();
        resolve("reload");
        return;
    }
    const timeout = setTimeout(() => {
        reject(new Error("Update failed due to timeout"));
    }, 10000);
    return navigator.serviceWorker.ready.then(registration => {
        return registration.update();
    })
    .then(registration => {
        if(!registration.installing && !registration.waiting) {
            notifySnackbar({title:"You already use the latest version"});
            resolve("latest");
        } else if(registration.waiting) {
            notifySnackbar({
                buttonLabel: "Activate",
                onButtonClick: () => {
                    activateUpdate(registration);
                },
                priority: "high",
                title: "New version available",
                variant: "warning"
            });
            resolve("waiting");
        } else {
            resolve("installing");
        }
    })
    .finally(() => {
        clearTimeout(timeout);
    });
});
