import {useStore} from "./General";
import {confirmComponentReducer} from "../reducers/confirmComponentReducer";

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
        type: confirmComponentReducer.SHOW,
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
