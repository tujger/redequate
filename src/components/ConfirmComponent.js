import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Button from "@material-ui/core/Button";
import {useHistory} from "react-router-dom";
import {confirmComponentReducer} from "../reducers/confirmComponentReducer";
import {useWindowData} from "../controllers/General";

const styles = theme => ({
    _dialog: {
        whiteSpace: "pre-wrap",
    },
    modal: {
        [theme.breakpoints.up("md")]: {
            width: "60%",
        },
        [theme.breakpoints.down("md")]: {
            borderRadius: 0,
            bottom: 0,
            left: 0,
            margin: 0,
            maxHeight: "initial",
            right: 0,
            position: "fixed",
            top: 0,
        },
    },
});

const ConfirmComponent = (
    {
        children,
        classes,
        confirmLabel = "OK",
        confirmProps = {},
        cancelLabel = confirmLabel ? "Cancel" : "Close",
        cancelProps = {},
        critical,
        message,
        modal = false,
        onCancel,
        onConfirm,
        title,
    }) => {
    const history = useHistory();
    const windowData = useWindowData();

    React.useEffect(() => {
        history.unblock = history.block(() => {
            onCancel();
            return false;
        })
        return () => {
            history.unblock && history.unblock();
            history.unblock = null;
        }
    }, []);

    return <Dialog
        className={classes._dialog}
        disableBackdropClick={modal}
        onClose={onCancel}
        onEscapeKeyDown={onCancel}
        open={true}
    >
        {title && <DialogTitle>{title}</DialogTitle>}
        {message || children ? <DialogContent>
            {message}
            {children}
        </DialogContent> : null}
        <DialogActions>
            {cancelLabel && <Button
                aria-label={cancelLabel}
                children={cancelLabel}
                color={"secondary"}
                onClick={onCancel}
                {...cancelProps}
            />}
            {confirmLabel && <Button
                aria-label={confirmLabel}
                children={confirmLabel}
                color={"secondary"}
                onClick={onConfirm}
                style={critical ? {color: "#ff0000"} : {}}
                {...confirmProps}
            />}
        </DialogActions>
    </Dialog>
}
ConfirmComponent.SHOW = confirmComponentReducer.SHOW;
ConfirmComponent.HIDE = confirmComponentReducer.HIDE;

export default withStyles(styles)(ConfirmComponent);
