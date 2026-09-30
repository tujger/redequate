import React from "react";
import CloseIcon from "@material-ui/icons/Close";
import {connect} from "react-redux";
import Button from "../controls/Button/Button";
import styles from "./styles/Snackbar.module.css";

const SimpleSnackbar = props => {
    const {open, message, buttonText, dispatch} = props;
    const timerRef = React.useRef(null);

    const handleClose = () => {
        dispatch(SimpleSnackbar.HIDE);
    };

    const pauseTimer = React.useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    const startTimer = React.useCallback(delay => {
        pauseTimer();
        timerRef.current = setTimeout(() => dispatch(SimpleSnackbar.HIDE), delay);
    }, [dispatch, pauseTimer]);

    React.useEffect(() => {
        if (!open) return undefined;
        startTimer(6000);
        const handleFocus = () => startTimer(3000);
        window.addEventListener("blur", pauseTimer);
        window.addEventListener("focus", handleFocus);
        return () => {
            pauseTimer();
            window.removeEventListener("blur", pauseTimer);
            window.removeEventListener("focus", handleFocus);
        };
    }, [open, message, buttonText, startTimer, pauseTimer]);

    if (!open) return null;

    return <div
        className={styles.root}
        onMouseEnter={pauseTimer}
        onMouseLeave={() => startTimer(3000)}
        role={"alert"}
    >
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
            <Button color={"primary"} onClick={handleClose} size={"small"} variant={"text"}>
                {buttonText}
            </Button>
            <Button color={"inherit"} icon={<CloseIcon fontSize={"small"}/>} onClick={handleClose} size={"small"} title={"Close"}/>
        </div>
    </div>;
};

SimpleSnackbar.SHOW = "snackbar_Show";
SimpleSnackbar.HIDE = {type: "snackbar_Hide"};

export const snackbarReducer = (state = {
    open: false,
    buttonText: "Close",
    message: "Snackbar text",
    error: ""
}, action) => {
    switch (action.type) {
        case SimpleSnackbar.SHOW:
            const newState = {open: true};
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
