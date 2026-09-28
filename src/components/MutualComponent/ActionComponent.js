import React from "react";
import Button from "../../controls/Button/Button";
import styles from "./styles/ActionComponent.module.css";

export default ({className = "", disabled, label, onClick, variant = "contained"}) => {
    return <Button
        children={label}
        className={[
            styles.action,
            variant === "contained" ? styles.actionContained : "",
            className
        ].join(" ")}
        // color={"secondary"}
        disabled={disabled}
        onClick={onClick}
        variant={variant}
        size={"small"}
    />
}
