import React from "react";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./Switch.module.css";

export default React.forwardRef(({checked = false, className, disabled = false, onChange, onPointerDown: givenOnPointerDown, ...props}, ref) => {
    const onPointerDown = useRippleEffect(givenOnPointerDown);
    const handleChange = event => onChange && onChange(event, event.target.checked);

    return <span
        className={[styles.switch, checked && styles.checked, disabled && styles.disabled, className]
            .filter(Boolean)
            .join(" ")}
        onPointerDown={disabled ? undefined : onPointerDown}
        ref={ref}
    >
        <input
            {...props}
            checked={checked}
            className={styles.input}
            disabled={disabled}
            onChange={handleChange}
            type={"checkbox"}
        />
        <span className={styles.track}>
            <span className={styles.thumb}/>
        </span>
    </span>;
});
