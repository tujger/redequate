import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Dialog from "@material-ui/core/Dialog";
import {useHistory} from "react-router-dom";

const styles = theme => ({
    modal: {
        [theme.breakpoints.up("sm")]: {
            width: "60%",
        },
        [theme.breakpoints.down("xs")]: {
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

const ModalComponent = ({onClose, classes, children}) => {
    const history = useHistory();

    React.useEffect(() => {
        const unblock = history.block(() => {
            onClose();
            return false;
        })
        return () => {
            unblock();
        }
    })

    return <Dialog open={true} classes={{paper: classes.modal}} onClose={onClose}>
        {children}
    </Dialog>
}

export default withStyles(styles)(ModalComponent);
