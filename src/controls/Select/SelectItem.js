import React from "react";
import useRippleEffect from "../../helpers/useRippleEffect";
import menuStyles from "../Menu/Menu.module.css";

export default React.forwardRef(({children, className, onPointerDown: givenOnPointerDown, value, ...props}, ref) => {
    const onPointerDown = useRippleEffect(givenOnPointerDown);

    return <div
        {...props}
        className={[menuStyles.menuItem, className].filter(Boolean).join(" ")}
        data-value={props["data-value"] ?? value}
        onPointerDown={onPointerDown}
        ref={ref}
    >
        {children}
    </div>;
});
