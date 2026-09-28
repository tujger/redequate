import React from "react";
import ReactDOM from "react-dom";
import styles from "./styles/ModalComponent.module.css";
import {useHistory} from "react-router-dom";

export default ({onClose, children}) => {
    const history = useHistory();
    const handleClose = event => onClose?.(event);

    React.useEffect(() => {
        const unblock = history.block(event => {
            handleClose(event);
            history.unblock = null;
            return false;
        })
        history.unblock = unblock;
        return () => {
            unblock();
            history.unblock = null;
        }
    })

    React.useEffect(() => {
        const handleKeyDown = event => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            handleClose(event);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const handleBackdropClick = event => {
        if (event.target === event.currentTarget) handleClose(event);
    };

    const modal = <div
        className={styles.root}
        onClick={handleBackdropClick}
    >
        <div
            aria-modal={"true"}
            className={styles.dialog}
            onClick={event => event.stopPropagation()}
            role={"dialog"}
        >
            {children}
        </div>
    </div>;

    return typeof document === "undefined" ? modal : ReactDOM.createPortal(modal, document.body);
}
