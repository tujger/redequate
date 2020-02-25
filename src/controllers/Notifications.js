import React from "react";
import {useSnackbar} from "notistack";
import RichSnackbarContent from "../components/RichSnackbarContent";

export const setupReceivingNotifications = (firebase, onMessage) => new Promise((resolve, reject) => {
  try {
    // Safari case
    //https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW1
    Notification.requestPermission().then(permission => {
      if(!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        reject(new Error("ServiceWorker is inactive"));
        return;
      }
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
            registration.showNotification(payload.notification.title, payload.notification);
          });
          resolve(token);
        } catch(e) {
          console.error("Failed to set up notifications:", e);
          reject(e);
        }
      })
    }).catch(error => {
      console.error(error);
      (onMessage || notifySnackbar)({title: error.message});
      reject(error);
    });
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
            console.log("NOTIF CLICK");
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
  if(!snackbar) {
    console.error("Cannot notify push notifications due to control element is unavailable. Please set up " +
      "'import {NotificationsSnackbar} from 'edeqa-pwa-react-core' and <NotificationsSnackbar/> in your file.");
    return;
  }
  if(props instanceof Error) {
    console.error(props);
    snackbar.payload = {
      priority: "high",
      title: props.message,
      variant: "error"
    }
  } else {
    snackbar.payload = props;
  }
  snackbar.click();
};

export const hasNotifications = () => {
  return Boolean(localStorage.getItem("notification-token"));
};
