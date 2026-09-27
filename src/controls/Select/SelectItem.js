import React from "react";
import useRippleEffect from "../../helpers/useRippleEffect";
import selectStyles from "./Select.module.css";

export default React.forwardRef(({children, className, onPointerDown: givenOnPointerDown, value, ...props}, ref) => {
    const onPointerDown = useRippleEffect(givenOnPointerDown);

    return <div
        {...props}
        className={[selectStyles.menuItem, className].filter(Boolean).join(" ")}
        data-value={props["data-value"] || value}
        onPointerDown={onPointerDown}
        ref={ref}
    >
        {children}
    </div>;
});
