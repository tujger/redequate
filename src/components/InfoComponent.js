import React from "react";
import styles from "./styles/InfoComponent.module.css";

const InfoComponent = ({children, prefix, suffix, variant = "caption", className, style}) => {
    if (!children) return null;
    const variantClass = styles[variant] || styles.caption;

    return <div className={[styles.info, variantClass, className].filter(Boolean).join(" ")} style={style}>
        <span>
            {prefix} {children} {suffix}
        </span>
    </div>
}

export default InfoComponent;
