import React from "react";
import ReactDOM from "react-dom";
import {useHistory} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {confirmComponentReducer} from "../reducers/confirmComponentReducer";
import useRippleEffect from "../helpers/useRippleEffect";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/ConfirmComponent.module.css";

const ConfirmComponent = props => {
    const history = useHistory();
    const {t} = useTranslation();
    const {
        children,
        confirmLabel = t("Common.OK"),
        confirmProps = {},
        cancelLabel = confirmLabel ? t("Common.Cancel") : t("Common.Close"),
        cancelProps = {},
        critical,
        message,
        modal = false,
        onCancel,
        onConfirm,
        title,
    } = props;
    const {
        className: confirmClassName,
        style: confirmGivenStyle,
        variant: confirmVariant,
        ...confirmButtonProps
    } = confirmProps;
    const {
        className: cancelClassName,
        variant: cancelVariant,
        ...cancelButtonProps
    } = cancelProps;
    const onConfirmPointerDown = useRippleEffect(confirmButtonProps.onPointerDown);
    const onCancelPointerDown = useRippleEffect(cancelButtonProps.onPointerDown);
    const dialogRef = React.useRef(null);

    React.useEffect(() => {
        history.unblock = history.block(() => {
            onCancel && onCancel();
            return false;
        });
        return () => {
            history.unblock && history.unblock();
            history.unblock = null;
        };
    }, []);

    React.useEffect(() => {
        const handleKeyDown = event => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            onCancel && onCancel();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    React.useEffect(() => {
        const handlePointerDown = event => {
            if (modal || !dialogRef.current || dialogRef.current.contains(event.target)) return;
            onCancel && onCancel();
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [modal, onCancel]);

    const dialog = <div
        className={styles.root}
        onClick={event => {
            if (!modal && event.target === event.currentTarget) onCancel && onCancel();
        }}
    >
        <div
            aria-modal="true"
            className={styles.dialog}
            onClick={event => event.stopPropagation()}
            ref={dialogRef}
            role="dialog"
        >
            {title && <div className={styles.title}>{title}</div>}
            {message || children ? <div className={styles.content}>
                {message}
                {children}
            </div> : null}
            <div className={styles.actions}>
                {cancelLabel && <button
                    aria-label={cancelLabel}
                    className={[styles.button, cancelVariant === "contained" && styles.buttonContained, cancelClassName]
                        .filter(Boolean)
                        .join(" ")}
                    type="button"
                    {...cancelButtonProps}
                    onClick={onCancel}
                    onPointerDown={onCancelPointerDown}
                >
                    {cancelLabel}
                </button>}
                {confirmLabel && <button
                    aria-label={confirmLabel}
                    className={[styles.button, confirmVariant === "contained" && styles.buttonContained, critical && baseStyles.error, confirmClassName]
                        .filter(Boolean)
                        .join(" ")}
                    style={confirmGivenStyle}
                    type="button"
                    {...confirmButtonProps}
                    onClick={onConfirm}
                    onPointerDown={onConfirmPointerDown}
                >
                    {confirmLabel}
                </button>}
            </div>
        </div>
    </div>;

    return typeof document === "undefined" ? dialog : ReactDOM.createPortal(dialog, document.body);
};

ConfirmComponent.SHOW = confirmComponentReducer.SHOW;
ConfirmComponent.HIDE = confirmComponentReducer.HIDE;

export default ConfirmComponent;
