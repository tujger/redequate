import React from "react";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./TextField.module.css";

export default props => {
    const {
        className,
        color = "primary",
        disabled = false,
        error = false,
        fullWidth = false,
        helper,
        id,
        label,
        onBlur,
        onChange,
        onFocus,
        onPointerDown: givenOnPointerDown,
        placeholder,
        type = "text",
        value,
        ...otherProps
    } = props;
    const colorClass = styles[color] || styles.primary;
    const [focused, setFocused] = React.useState(false);
    const hasValue = value !== undefined && value !== null && value !== "";
    const active = focused || hasValue;
    const onPointerDown = useRippleEffect(givenOnPointerDown);

    const handleFocus = event => {
        setFocused(true);
        onFocus && onFocus(event);
    };

    const handleBlur = event => {
        setFocused(false);
        onBlur && onBlur(event);
    };

    return <label
        className={[
            styles.field,
            colorClass,
            active && styles.active,
            disabled && styles.disabled,
            error && styles.error,
            fullWidth && styles.fullWidth,
            label && styles.hasLabel,
            className,
        ].filter(Boolean).join(" ")}
        htmlFor={id}
        onPointerDown={disabled ? undefined : onPointerDown}
    >
        {label && <span className={styles.label}>{label}</span>}
        <input
            {...otherProps}
            aria-invalid={error || undefined}
            className={styles.input}
            disabled={disabled}
            id={id}
            onBlur={handleBlur}
            onChange={onChange}
            onFocus={handleFocus}
            placeholder={placeholder}
            type={type}
            value={value}
        />
        {helper && <span className={styles.helper}>{helper}</span>}
    </label>;
};
