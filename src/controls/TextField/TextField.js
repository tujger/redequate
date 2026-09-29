import ClearIcon from "@material-ui/icons/Clear";
import React from "react";
import useRippleEffect from "../../helpers/useRippleEffect";
import Button from "../Button/Button";
import styles from "./TextField.module.css";

export default props => {
    const {
        className,
        clearable = true,
        color = "primary",
        disabled = false,
        endAdornment = undefined,
        error = false,
        fullWidth = false,
        helper,
        id,
        inputComponent = undefined,
        label = undefined,
        onBlur,
        onClear,
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
    const inputRef = React.useRef(null);
    const hasValue = value !== undefined && value !== null && value !== "";
    const active = focused || hasValue;
    const canClear = clearable && hasValue && !disabled && (onChange || onClear);
    const onPointerDown = useRippleEffect(givenOnPointerDown);

    const handleClear = event => {
        event.preventDefault();
        event.stopPropagation();
        const clearEvent = {
            currentTarget: event.currentTarget,
            persist: () => {
            },
            target: {
                name: otherProps.name,
                value: "",
            },
        };
        if (onClear) onClear(clearEvent);
        else onChange(clearEvent);
        if (inputRef.current) inputRef.current.focus();
    };

    const handleFocus = event => {
        setFocused(true);
        onFocus && onFocus(event);
    };

    const handleBlur = event => {
        setFocused(false);
        onBlur && onBlur(event);
    };

    const inputProps = {
        ...otherProps,
        "aria-invalid": error || undefined,
        className: [styles.input, endAdornment && styles.inputWithAdornment].filter(Boolean).join(" "),
        disabled,
        id,
        onBlur: handleBlur,
        onChange,
        onFocus: handleFocus,
        placeholder,
        type,
        value,
    };
    const inputRefCallback = input => {
        inputRef.current = input;
    };
    const clearButton = canClear && <Button
        className={styles.adornment}
        icon={<ClearIcon/>}
        onClick={handleClear}
        size={"small"}
        title={"Clear"}
    />;
    const endAdornmentUpdated = endAdornment && React.cloneElement(endAdornment, {
        className: styles.adornment,
        size: "small",
        variant: "text"
    })

    return <label
        className={[
            styles.field,
            colorClass,
            active && styles.active,
            disabled && styles.disabled,
            error && styles.error,
            fullWidth && styles.fullWidth,
            canClear && styles.hasClear,
            label && styles.hasLabel,
            className,
        ].filter(Boolean).join(" ")}
        htmlFor={id}
        onPointerDown={disabled ? undefined : onPointerDown}
    >
        {label && <span className={styles.label}>{label}</span>}
        <span className={styles.endAdornment}>
            {clearButton}
            {endAdornmentUpdated}
        </span>
        {inputComponent
            ? React.createElement(inputComponent, {
                ...inputProps,
                inputRef: inputRefCallback
            })
            : <input
                {...inputProps}
                ref={inputRef}
            />}
        {helper && <span className={styles.helper}>{helper}</span>}
    </label>;
};
