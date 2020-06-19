import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import {connect, useDispatch} from "react-redux"
import Dialog from "@material-ui/core/Dialog";
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

let unblock = null;
let dispatch_ = null;
let history_ = null;
const ModalComponent = (props) => {
    const {classes, content, label, button, open} = props;
    dispatch_ = useDispatch();
    history_ = useHistory();

    const handleClose = () => {
        dispatch_({type: ModalComponent.HIDE});
    };
    if(!content || !content.$$typeof) return null;

    return <Dialog open={open} classes={{paper: classes.modal}} onClose={handleClose}>
            {content}
    </Dialog>
}

ModalComponent.SHOW = "Modal_show";
ModalComponent.HIDE = "Modal_hide";
ModalComponent.skipStore = true;

export const modalComponent = (state = {content: null, open: false, label: null, button: null}, action) => {
    switch (action.type) {
        case ModalComponent.SHOW:
            unblock = history_.block(tx => {
                dispatch_({type: ModalComponent.HIDE});
                return false;
            })
            return {...state, content: action.content, open: true, label: action.label, button:action.button};
        case ModalComponent.HIDE:
            unblock && unblock();
            return {...state, content: null, open: false, label: null, button: null};
        default:
            return state;
    }
};

const mapStateToProps = ({modalComponent}) => ({
    button: modalComponent.button,
    content: modalComponent.content,
    label: modalComponent.label,
    open: modalComponent.open,
});

export default connect(mapStateToProps)(withStyles(styles)(ModalComponent));
