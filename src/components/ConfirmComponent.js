import React from "react";
import {useTranslation} from "react-i18next";
import Button from "../controls/Button/Button";
import {confirmComponentReducer} from "../reducers/confirmComponentReducer";
import useRippleEffect from "../helpers/useRippleEffect";
import baseStyles from "../themes/Base.module.css";
import ModalComponent from "./ModalComponent";
import styles from "./styles/ConfirmComponent.module.css";

const ConfirmComponent = props => {
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

    return <ModalComponent
        closeOnBackdropClick={!modal}
        onClose={onCancel}
    >
        {title && <div className={styles.title}>{title}</div>}
        {message || children ? <div className={styles.content}>
            {message}
            {children}
        </div> : null}
        <div className={styles.actions}>
            {cancelLabel && <Button
                {...cancelButtonProps}
                onClick={onCancel}
                variant={"text"}
            >
                {cancelLabel}
            </Button>}
            {confirmLabel && <Button
                {...confirmButtonProps}
                className={[critical && baseStyles.error].filter(Boolean).join(" ")}
                color={"primary"}
                onClick={onConfirm}
                variant={"text"}
            >
                {confirmLabel}
            </Button>}
        </div>
    </ModalComponent>;
};

ConfirmComponent.SHOW = confirmComponentReducer.SHOW;
ConfirmComponent.HIDE = confirmComponentReducer.HIDE;

export default ConfirmComponent;
