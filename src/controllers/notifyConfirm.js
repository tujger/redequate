import ConfirmComponent from "../components/ConfirmComponent";
import {useStore} from "./General";

export const notifyConfirm = (
    {
        children = null,
        confirmLabel = "OK",
        cancelLabel = confirmLabel ? "Cancel" : "Close",
        critical = false,
        message = "",
        modal = false,
        onCancel = () => {
        },
        onConfirm = () => {
        },
        title = "",
    }) => {
    const store = useStore();
    store.dispatch({
        type: ConfirmComponent.SHOW,
        props: {
            children,
            confirmLabel,
            cancelLabel,
            critical,
            message,
            modal,
            onCancel,
            onConfirm,
            title
        }
    })
}

export default notifyConfirm;
