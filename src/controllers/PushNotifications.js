import React from "react";
import SnackbarContent from "@material-ui/core/SnackbarContent";
import Button from "@material-ui/core/Button";
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
// import {withSnackbar} from "notistack";
import {useSnackbar} from "notistack";
import RichSnackbarContent from "../components/RichSnackbarContent";

export const setupReceivingNotifications = (firebase, onMessage, onComplete, onError) => {
  try {
    // Safari case
    //https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW1
    Notification.requestPermission().then(permission => {
      console.log(permission);
      if(!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      console.log("failed");
        onError && onError(new Error("ServiceWorker is inactive"));
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
            (onMessage || pushNotificationsSnackbarNotify)({
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
          onComplete && onComplete(token);
        } catch(e) {
          console.error("Failed to set up notifications:", e);
          onError && onError(e);
        }
      })
    }).catch(error => {
      console.error(error);
      (onMessage || pushNotificationsSnackbarNotify)({title: error.message});
      onError && onError(error);
    });
  } catch (error) {
    console.error(error);
    (onMessage || pushNotificationsSnackbarNotify)({title: error.message});
    onError && onError(error);
  }
};

export const PushNotificationsSnackbar = () => {
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

      payload.key = enqueueSnackbar(payload.title, {
        content: Snackbar,
        persist: payload.priority === "high"
      })
    }}
  />;
};

export const pushNotificationsSnackbarNotify = props => {
  const snackbar = document.getElementById("__edeqa_pwa_service_worker_snackbar");
  if(!snackbar) {
    console.error("Cannot notify push notifications due to control element is unavailable. Please set up " +
      "'import {PushNotificationsSnackbar} from 'edeqa-pwa-react-core' and <PushNotificationsSnackbar/> in your file.");
    return;
  }
  snackbar.payload = props;
  snackbar.click();
};

export const hasNotifications = () => {
  return Boolean(localStorage.getItem("notification-token"));
};
