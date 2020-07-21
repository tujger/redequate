import React from "react";
import {useSnackbar} from "notistack";
import RichSnackbarContent from "../components/RichSnackbarContent";
import PropTypes from "prop-types";

export const setupReceivingNotifications = (firebase, onMessage) => new Promise((resolve, reject) => {
    try {
        // Safari case
        //https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW1
        const messaging = firebase.messaging();
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                return messaging.getToken();
            } else {
                throw new Error("Notifications denied");
            }
        }).then(token => {
            localStorage.setItem("notification-token", token);
            messaging.onMessage(payload => {
                console.log("message", payload, payload.data);
                const options = {
                    ...payload.notification,
                    from: payload.from,
                    image: payload.notification.icon,
                    priority: payload.priority,
                };
                console.log("options", options);
                (onMessage || notifySnackbar)(options);
                //https://web-push-book.gauntface.com/chapter-05/02-display-a-notification/
                //https://developers.google.com/web/fundamentals/push-notifications/display-a-notification
                // registration.showNotification(payload.notification.title, payload.notification);
            });
            resolve(token);
        }).catch(error => {
            (onMessage || notifySnackbar)({title: error.message});
            reject(error);
        });
        /*      console.log(messaging);
              debugger;
              if(messaging.swRegistration) {
                reject(new Error("AAA"));
                let token = null;
                if (!hasNotifications()) {
                  token = await messaging.getToken();
                  localStorage.setItem("notification-token", token);
                }


              } else {
                if(!navigator.serviceWorker || !navigator.serviceWorker.controller) {
                  reject(new Error("Subscribing failed: ServiceWorker is inactive"));
                  return;
                }
                // reject(new Error("No error"));return;
                navigator.serviceWorker.ready.then(async registration => {
                  console.log("Set up notifications", registration);
                  const messaging = firebase.messaging();
                  try {
                    let token = null;
                    if (!hasNotifications()) {
                      token = await messaging.getToken();
                      localStorage.setItem("notification-token", token);
                    }
                    messaging.onMessage(payload => {
                      console.log("message", payload);
                      (onMessage || notifySnackbar)({
                        body: payload.notification.body,
                        from: payload.from,
                        image: payload.notification.image,
                        title: payload.notification.title,
                        priority: payload.priority,
                        tag: payload.notification.tag,
                      });
                      //https://web-push-book.gauntface.com/chapter-05/02-display-a-notification/
                      //https://developers.google.com/web/fundamentals/push-notifications/display-a-notification
                      // registration.showNotification(payload.notification.title, payload.notification);
                    });
                    resolve(token);
                  } catch(e) {
                    console.error("Failed to set up notifications:", e);
                    reject(e);
                  }
                })
              }
            }).catch(error => {
              console.error(error);
              (onMessage || notifySnackbar)({title: error.message});
              reject(error);
            });*/
    } catch (error) {
        console.error(error);
        (onMessage || notifySnackbar)({title: error.message});
        reject(error);
    }
});

export const NotificationsSnackbar = () => {
    const {enqueueSnackbar, closeSnackbar} = useSnackbar();

    return <div
        id={"__edeqa_pwa_service_worker_snackbar"}
        style={{display: "none"}}
        onClick={evt => {
            let payload = evt.currentTarget.payload;

            const Snackbar = (key) => {
                return <RichSnackbarContent
                    message={payload.title}
                    closeHandler={() => {
                        closeSnackbar(key);
                    }}
                    body={payload.body}
                    buttonLabel={payload.buttonLabel}
                    image={payload.image}
                    onButtonClick={payload.onButtonClick}
                    onClick={() => {
                        closeSnackbar(key);
                        payload.onClick && payload.onClick(key);
                    }}
                    variant={payload.variant}
                />
            };
            enqueueSnackbar(payload.title, {
                content: Snackbar,
                persist: payload.priority === "high"
            })
        }}
    />;
};

export const notifySnackbar = props => {
    const snackbar = document.getElementById("__edeqa_pwa_service_worker_snackbar");
    if (!snackbar) {
        console.error("Cannot notify push notifications due to control element is unavailable. Please set up " +
            "\"import {NotificationsSnackbar} from 'edeqa-pwa-react-core'\" and <NotificationsSnackbar/> in your file.");
        return;
    }
    const error = props.error || props;
    if (error && (error instanceof Error || error.constructor.name === "FirebaseStorageError")) {
        console.error("Error", props);
        snackbar.payload = {
            ...props,
            ...error,
            title: error.message,
            priority: "high",
            variant: "error"
        }
    } else if(props.constructor.name === "String") {
        snackbar.payload = {title: props};
    } else {
        snackbar.payload = props;
    }
    snackbar.click();
};
notifySnackbar.propTypes = {
    title: PropTypes.any,
    variant: PropTypes.string,
    buttonLabel: PropTypes.string,
    onButtonClick: PropTypes.any,
    onClick: PropTypes.any,
    error: PropTypes.any,
    priority: PropTypes.string,
};

export const hasNotifications = () => {
    return Boolean(localStorage.getItem("notification-token"));
};
