import React from "react";
import selectStyles from "./Select.module.css";

export default React.forwardRef(({children, className, value, ...props}, ref) => <div
        {...props}
        className={[selectStyles.menuItem, className].filter(Boolean).join(" ")}
        data-value={props["data-value"] ?? value}
        ref={ref}
    >
        {children}
    </div>);
