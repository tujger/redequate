import React from "react";
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import {connect} from "react-redux";
import {snackbarReducer} from "../reducers/snackbarReducer";

const SimpleSnackbar = props => {
    const {open, message, buttonText, dispatch} = props;

    const onButtonClick = () => {
        dispatch(snackbarReducer.HIDE);
    };

    const handleClose = (event, reason) => {
        if (reason === "clickaway") {
            return;
        }
        dispatch(snackbarReducer.HIDE);
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
                <Button color={"primary"} size={"small"} onClick={onButtonClick} children={buttonText}/>
                <IconButton size={"small"} aria-label={"close"} color={"inherit"} onClick={handleClose}>
                    <CloseIcon fontSize={"small"}/>
                </IconButton>
            </React.Fragment>
        }
    />
};


const mapStateToProps = ({snackbar}) => ({
    open: snackbar.open,
    buttonText: snackbar.buttonText,
    message: snackbar.message,
    error: snackbar.error
});

export default connect(mapStateToProps)(SimpleSnackbar);
