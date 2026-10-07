import BackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import React from "react";
import {useTranslation} from "react-i18next";
import Button from "../../controls/Button/Button";
import useRippleEffect from "../../helpers/useRippleEffect";
import NavigationToolbar from "../NavigationToolbar";
import toolbarStyles from "./styles/Toolbar.module.css";

export default (
    {
        bottom,
        disabled,
        onCancel,
        onSend,
        top,
        title,
        uploadComponent,
    }) => {
    const {t} = useTranslation();
    const onPointerDown = useRippleEffect();

    const handleKeyDown = handler => event => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handler();
    };

    return <>
        {top && <NavigationToolbar
            backButton={<div
                aria-disabled={disabled}
                className={toolbarStyles.iconButton}
                onClick={disabled ? undefined : onCancel}
                onKeyDown={handleKeyDown(onCancel)}
                onPointerDown={onPointerDown}
                role='button'
                tabIndex={disabled ? -1 : 0}
            >
                <BackIcon/>
            </div>}
            children={title}
            className={toolbarStyles.toolbar}
            mediumButton={uploadComponent}
            rightButton={<Button
                color={"secondary"}
                disabled={disabled}
                icon={<SendIcon/>}
                onClick={onSend}
                title={t("Common.Send")}
            />}
        />}
        {bottom && <div className={toolbarStyles.actions}>
            <div className={toolbarStyles.upload}>{uploadComponent}</div>
            <Button onClick={onCancel} variant={"text"}>{t("Common.Cancel")}</Button>
            <Button color={"primary"} disabled={disabled} onClick={onSend} variant={"text"}>{t("Common.Send")}</Button>
        </div>}
    </>
};
