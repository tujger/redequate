import React from "react";
import ReactDOM from "react-dom";
import {useSnackbar} from "notistack";
import RichSnackbarContent from "../components/RichSnackbarContent";
import {useMetaInfo} from "./General";
import {useHistory} from "react-router-dom";
import {hasWrapperControlInterface, wrapperControlCall} from "./WrapperControl";
import {notifySnackbar} from "./notifySnackbar";

export const setupReceivingNotifications = (firebase, onMessage) => new Promise((resolve, reject) => {
    try {
        // Safari case
        // https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW1
        const messaging = firebase.messaging();
        window.Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                return messaging.getToken();
            } else {
                throw new Error("Notifications denied");
            }
        }).then(token => {
            messaging.onMessage(payload => {
                console.log("[Notifications] incoming " + JSON.stringify(payload));
                const data = payload.notification || payload.data;
                if (onMessage) {
                    onMessage({
                        ...data,
                        from: payload.from,
                        image: data.icon,
                        priority: payload.priority,
                    })
                } else {
                    notifySnackbar({
                        from: payload.from,
                        image: data.image,
                        priority: payload.priority,
                        id: data.tag,
                        title: data.body,
                    })
                }
                // https://web-push-book.gauntface.com/chapter-05/02-display-a-notification/
                // https://developers.google.com/web/fundamentals/push-notifications/display-a-notification
                // registration.showNotification(payload.notification.title, payload.notification);
            });
            resolve(token);
        }).catch(error => {
            if (error.code === "messaging/unsupported-browser") {
                if (hasWrapperControlInterface()) {
                    wrapperControlCall({method: "subscribeNotifications", timeout: 30000}).then((response) => {
                        console.log("[Notifications] token " + JSON.stringify(response));
                        resolve(response);
                    }).catch(error => {
                        console.error(error);
                        reject(error);
                    })
                    return;
                }
            } else if(error.code === "messaging/failed-service-worker-registration") {
                console.error(error);
                reject(error);
                return;
            }
            if (onMessage) onMessage({title: error.message});
            else setTimeout(() => notifySnackbar(error), 10);
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
                }); */
    } catch (error) {
        if (error.code === "messaging/unsupported-browser") {
            if (hasWrapperControlInterface()) {
                wrapperControlCall({method: "subscribeNotifications", timeout: 30000}).then((response) => {
                    console.log("[Notifications] token " + JSON.stringify(response));
                    resolve(response);
                }).catch(error => {
                    console.error(error);
                    reject(error);
                })
                return;
            }
        } else if(error.code === "messaging/failed-service-worker-registration") {
            console.error(error);
            reject(error);
            return;
        }
        console.error(error);
        (onMessage || notifySnackbar)({title: error.message});
        reject(error);
    }
});

export const NotificationsSnackbar = () => {
    const {enqueueSnackbar, closeSnackbar} = useSnackbar();
    const metaInfo = useMetaInfo();
    const history = useHistory();

    return <div
        id={"__edeqa_pwa_service_worker_snackbar"}
        style={{display: "none"}}
        onClick={evt => {
            const {system, ...payload} = evt.currentTarget.payload;
            if (system && !document.hasFocus()) {
                window.Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        const node = document.createElement("div");
                        ReactDOM.render(<>{payload.title}</>, node, () => {
                            try {
                                const title = metaInfo.title;
                                const onclick = () => {
                                    history.push(payload.id || "/")
                                    // window.open(payload.id || "/");
                                    window.focus();
                                };
                                const options = {
                                    body: node.innerText,
                                    // image: "/favicon.ico",
                                    icon: "/favicon.ico",
                                    tag: payload.id || title,
                                    renotify: true,
                                    // requireInteraction: true,
                                };
                                /* navigator.serviceWorker.ready.then(reg => {
                                    reg.showNotification(title, {...options,
                                    actions: [
                                        {title: "Open", action: onclick}
                                    ]})
                                }) */
                                console.log(`[Notification] ${title}: ${JSON.stringify(options)}`);
                                const notification = new window.Notification(title, options);
                                notification.onclick = onclick;
                            } catch (error) {
                                console.error(error)
                            }
                        });
                    } else {
                        throw new Error("Notifications denied");
                    }
                }).catch(error => {
                    console.error(error)
                });
            }
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
}

export const hasNotifications = () => {
    return false;
    // return Boolean(localStorage.getItem("notification-token"));
};
