import React from "react";
import BackIcon from "@material-ui/icons/ArrowBack";
import {useHistory} from "react-router-dom";
import {useTranslation} from "react-i18next";
import Button from "../controls/Button/Button";
import useRippleEffect from "../helpers/useRippleEffect";
import styles from "./styles/NavigationToolbar.module.css";

export default props => {
    const {t} = useTranslation();
    const {
        alignItems = "center",
        backButton,
        children,
        className,
        justify,
        mediumButton,
        rightButton,
        style,
    } = props;
    const history = useHistory();
    const defaultBackButton = <Button
        color={"secondary"}
        icon={<BackIcon/>}
        onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            history.goBack();
        }}
        tabIndex={0}
        title={t("Common.Back")}
    />;

    const givenBackButton = backButton === undefined ? defaultBackButton : backButton;
    const onBackPointerDown = useRippleEffect(givenBackButton?.props.onPointerDown);
    const isDefaultBackButton = givenBackButton === defaultBackButton;

    const button = givenBackButton && React.cloneElement(givenBackButton, {
        className: [styles.backButton, givenBackButton.props.className].filter(Boolean).join(" "),
        onClick: givenBackButton.props.onClick || (() => history.goBack()),
        onPointerDown: onBackPointerDown,
        style: isDefaultBackButton
            ? {...(givenBackButton.props.style || {})}
            : givenBackButton.props.style,
    });

    const isChildrenLabel = typeof children === "string";

    return <div
        className={[styles.toolbar, className].filter(Boolean).join(" ")}
        style={{
            "--navigation-align-items": alignItems,
            "--navigation-justify": justify || "flex-start",
            ...(style || {}),
        }}
    >
        <div className={styles.side}>
            {button}
        </div>
        <div className={styles.content}>
            {isChildrenLabel ? <h6 className={styles.title}>{children}</h6> : children}
        </div>
        {mediumButton && <div className={styles.side}>
            {mediumButton}
        </div>}
        <div className={styles.side}>
            {rightButton}
        </div>
    </div>
};
