import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Button from "@material-ui/core/Button";
import {useHistory} from "react-router-dom";

const styles = theme => ({
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

const ConfirmComponent = ({onConfirm, onCancel, confirmLabel = "OK", cancelLabel = "Cancel", critical, modal, classes, children, message, title}) => {
    const history = useHistory();

    React.useEffect(() => {
        const unblock = history.block(() => {
            onCancel();
            return false;
        })
        return () => {
            unblock();
        }
    })

    return <Dialog
        open={true}
        disableBackdropClick={modal}
        onEscapeKeyDown={onCancel}
        onClose={onCancel}
    >
        {title && <DialogTitle>{title}</DialogTitle>}
        <DialogContent>
            {message}
            {children}
        </DialogContent>
        <DialogActions>
            <Button aria-label={cancelLabel} onClick={onCancel} color={"secondary"}>{cancelLabel}</Button>
            <Button aria-label={confirmLabel} onClick={onConfirm} color={"secondary"} style={critical ? {color: "#ff0000"} : {}} autoFocus>{confirmLabel}</Button>
        </DialogActions>
    </Dialog>
}

export default withStyles(styles)(ConfirmComponent);
