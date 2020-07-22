import React from "react";
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import {connect} from "react-redux";

const SimpleSnackbar = props => {
    const {open, message, buttonText, dispatch} = props;

    const onButtonClick = () => {
        dispatch(SimpleSnackbar.HIDE);
    };

    const handleClose = (event, reason) => {
        if (reason === "clickaway") {
            return;
        }
        dispatch(SimpleSnackbar.HIDE);
    };

    return <Snackbar
        anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
        }}
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message={message}
        action={
            <React.Fragment>
                <Button color="primary" size="small" onClick={onButtonClick} children={buttonText}/>
                <IconButton size="small" aria-label="close" color="inherit" onClick={handleClose}>
                    <CloseIcon fontSize="small"/>
                </IconButton>
            </React.Fragment>
        }
    />
};

SimpleSnackbar.SHOW = "snackbar_Show";
SimpleSnackbar.HIDE = {type: "snackbar_Hide"};

export const snackbarReducer = (state = {open: false, buttonText: "Close", message: "Snackbar text", error: ""}, action) => {
    switch (action.type) {
        case SimpleSnackbar.SHOW:
            let newState = {open: true};
            if (action.message) newState.message = action.message;
            if (action.buttonText) newState.buttonText = action.buttonText;
            if (action.onButtonClick) newState.onButtonClick = action.onButtonClick;
            if (action.error) newState.error = action.error;
            return {...state, ...newState};
        case SimpleSnackbar.HIDE.type:
            return {...state, open: false};
        default:
            return state;
    }
};

const mapStateToProps = ({snackbar}) => ({
    open: snackbar.open,
    buttonText: snackbar.buttonText,
    message: snackbar.message,
    error: snackbar.error
});

export default connect(mapStateToProps)(SimpleSnackbar);
