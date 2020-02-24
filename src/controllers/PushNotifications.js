import React from "react";
import SnackbarContent from '@material-ui/core/SnackbarContent';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
// import {withSnackbar} from "notistack";
import {useSnackbar} from "notistack";

export const setupReceivingNotifications = (firebase, onMessage) => {
  try {
    // Safari case
    //https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW1
    Notification.requestPermission().then(permission => {
      console.log(permission);
      navigator.serviceWorker.ready.then(async registration => {
        const messaging = firebase.messaging();
        if (!localStorage.getItem("notification-token")) {
          const token = await messaging.getToken();
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
      })
    }).catch(error => {
      console.error(error);
      (onMessage || pushNotificationsSnackbarNotify)({title: error.message});
    });
  } catch (error) {
    console.error(error);
    (onMessage || pushNotificationsSnackbarNotify)({title: error.message});
  }
};


export const PushNotificationsSnackbar = () => {
  const {enqueueSnackbar, closeSnackbar} = useSnackbar();

  const customAction = (payload, label, onClick) => <Button
    size="small" aria-label="close" color="inherit"
    onClick={onClick || (() => {
      closeSnackbar(payload.key)
    })}>{label}
  </Button>;
  const closeAction = payload => <IconButton
    size="small" aria-label="close" color="inherit"
    onClick={() => {
      closeSnackbar(payload.key)
    }}><CloseIcon fontSize="small"/>
  </IconButton>;

  return <div
    id={"__edeqa_pwa_service_worker_snackbar"}
    style={{display: "none"}}
    onClick={evt => {
      let payload = evt.currentTarget.payload;

      const Snackbar = () => {
        return <div>
          <SnackbarContent
            open={true}
            message={payload.title}
            action={<React.Fragment>
              {payload.buttonLabel ? customAction(payload, payload.buttonLabel, payload.onButtonClick) : null}
              {payload.buttonLabel ? (payload.onButtonClick ? closeAction(payload) : null) : closeAction(payload)}
            </React.Fragment>}
          />
        </div>;
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
  snackbar.payload = props;
  snackbar.click();
};
