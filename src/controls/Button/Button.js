import React from "react";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./Button.module.css";

const variants = ["contained", "outlined", "text"];

export default props => {
    const {
        children,
        className,
        color = "primary",
        disabled = false,
        fullWidth = false,
        icon,
        onClick,
        onKeyDown: givenOnKeyDown,
        onPointerDown: givenOnPointerDown,
        size = "medium",
        title = undefined,
        variant,
        ...otherProps
    } = props;
    const isIconOnly = icon && children == null;
    const givenVariant = variant || (icon ? "text" : "contained");
    const currentVariant = variants.includes(givenVariant) ? givenVariant : "contained";
    const colorClass = styles[color] || styles.primary;
    const sizeClass = styles[size] || "";
    const onPointerDown = useRippleEffect(givenOnPointerDown);
    const onKeyDown = event => {
        givenOnKeyDown && givenOnKeyDown(event);
        if (event.defaultPrevented || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onClick && onClick(event);
    };

    if (givenVariant && !variants.includes(givenVariant) && typeof console !== "undefined") {
        console.warn(`[Button] Unsupported variant: ${givenVariant}`);
    }

    return <div
        {...otherProps}
        aria-disabled={disabled || undefined}
        aria-label={title ?? label}
        className={[
            styles.button,
            styles[currentVariant],
            isIconOnly && styles.iconButton,
            disabled && styles.disabled,
            colorClass,
            sizeClass,
            fullWidth && styles.fullWidth,
            className,
        ].filter(Boolean).join(" ")}
        onClick={disabled ? undefined : onClick}
        onKeyDown={disabled ? undefined : onKeyDown}
        onPointerDown={disabled ? undefined : onPointerDown}
        role={"button"}
        tabIndex={disabled ? -1 : 0}
        title={title}
    >
        {icon}
        {children}
    </div>;
};
