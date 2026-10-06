import React from "react";
import Button from "../../controls/Button/Button";
import styles from "./styles/ActionComponent.module.css";

export default ({className = "", label, variant = "contained", ...rest}) => {
    return <Button
        {...rest}
        children={label}
        className={[
            styles.action,
            className
        ].join(" ")}
        variant={variant}
        size={"small"}
    />
}
