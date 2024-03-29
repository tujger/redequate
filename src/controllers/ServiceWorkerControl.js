import * as serviceWorker from "../serviceWorker";
import {firebaseMessaging} from "./Firebase";
import {hasWrapperControlInterface, wrapperControlCall} from "./WrapperControl";
import notifySnackbar from "./notifySnackbar";
import notifyConfirm from "./notifyConfirm";
import {cacheDatas} from "./General";

const activateUpdate = registration => {
    try {
        registration.waiting.postMessage({type: "SKIP_WAITING"});
        if (firebaseMessaging.messaging && firebaseMessaging.messaging().swRegistration) {
            console.log("[SWC] activate update");
            firebaseMessaging.messaging().swRegistration.update().then(() => {
                console.log("[SWC] update finished, reloading");
                window.location.reload();
            }).catch(error => {
                console.error(error);
                window.location.reload();
            });
        } else {
            console.log("[SWC] sw.registration is not found, just reloading");
            window.location.reload();
        }
    } catch (e) {
        console.error(e);
        window.location.reload();
    }
};

export const serviceWorkerRegister = () => {
    serviceWorker.register({
        skipWaiting: true,
        onUpdate: registration => {
            if (registration && registration.waiting) {
                /*notifySnackbar({
                    buttonLabel: "Update",
                    onButtonClick: () => {
                        activateUpdate(registration);
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });*/
                notifyConfirm({
                    cancelLabel: null,
                    confirmLabel: "Continue",
                    onConfirm: () => {
                        activateUpdate(registration);
                    },
                    modal: true,
                    message: "Thank you for your loyalty and feedback. We've made some improvements and fixed some bugs.\nPlease continue to enjoy our friendly community.",
                });
            }
        },
        onInit: registration => {
            if (registration && registration.waiting) {
                /*notifySnackbar({
                    buttonLabel: "Activate",
                    onButtonClick: () => {
                        activateUpdate(registration);
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });*/
                notifyConfirm({
                    cancelLabel: null,
                    confirmLabel: "Continue",
                    onConfirm: () => {
                        activateUpdate(registration);
                    },
                    modal: true,
                    message: "Thank you for your loyalty and feedbacks. We've made some improvements and fixed some bugs.\nPlease continue to enjoy our friendly community.",
                });
            }
        },
    });

    if (navigator.serviceWorker) {
        try {
            navigator.serviceWorker.addEventListener("message", (event) => {
                cacheDatas.put("ServiceWorkerControl", event.data)
            });
        } catch (error) {
            console.error(error);
        }
    }
};

export const checkForUpdate = (explicitCheck = true) => new Promise((resolve, reject) => {
    if (hasWrapperControlInterface()) {
        wrapperControlCall({method: "clearCache"}).then(result => {
            console.log("[SWC] reload by WrapperControlInterface");
            resolve("reload")
            window.location.reload();
        }).catch(reject);
        return;
    }
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        console.log("[SWC] sw is not defined");
        if (explicitCheck) {
            resolve("reload");
            window.location.reload();
        }
        return;
    }
    const timeout = setTimeout(() => {
        reject(new Error("Update failed due to timeout"));
    }, 10000);
    return navigator.serviceWorker.ready
        .then(registration => registration && registration.update())
        .then(registration => {
            if (!registration) {
                console.log("[SWC] sw.registration is not defined");
                if (explicitCheck) {
                    resolve("reload");
                    window.location.reload();
                }
            } else if (!registration.installing && !registration.waiting) {
                if (explicitCheck) notifySnackbar({title: "You already use the latest version"});
                resolve("latest");
                // window.location.reload();
            } else if (registration.waiting) {
                /*notifySnackbar({
                    buttonLabel: "Activate",
                    onButtonClick: () => {
                        activateUpdate(registration);
                    },
                    priority: "high",
                    title: "New version available",
                    variant: "warning"
                });*/
                notifyConfirm({
                    cancelLabel: null,
                    confirmLabel: "Continue",
                    onConfirm: () => {
                        activateUpdate(registration);
                    },
                    modal: true,
                    message: "Thank you for your loyalty and feedback. We've made some improvements and fixed bugs.\nPlease continue to enjoy our friendly community.",
                });
                resolve("waiting");
            } else {
                resolve("installing");
            }
        }).catch(error => {
            reject(error);
        }).finally(() => {
            clearTimeout(timeout);
        });
});
