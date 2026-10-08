export default props => {
    const snackbar = document.getElementById("__edeqa_pwa_service_worker_snackbar");
    const error = props.error || props;
    if (!snackbar) {
        if (error) console.error(error);
        else console.log(`[Notifications] ${JSON.stringify(props)}`);
        console.error("Cannot notify push notifications due to control element is unavailable. Please set up " +
            "\"import {NotificationsSnackbar} from 'redequate'\" and <NotificationsSnackbar/> in your file.");
        return;
    }
    if (error && (error instanceof Error || error.constructor.name === "FirebaseStorageError")) {
        console.error(props);
        snackbar.payload = {
            ...props,
            ...error,
            title: error.message,
            priority: "high",
            variant: "error"
        }
    } else if (!props) {
        console.warn("Snackbar notified with empty props");
        return;
    } else if (props.constructor.name === "String") {
        snackbar.payload = {title: props};
    } else {
        snackbar.payload = props;
    }
    snackbar.click();
};
