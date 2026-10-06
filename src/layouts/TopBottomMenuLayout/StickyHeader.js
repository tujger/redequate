import React from "react";
import styles from "./styles/StickyHeader.module.css";

export default props => {
    const {className, children, headerComponent, stickyBottom} = props;

    return <div className={["TopBottomMenuLayout", styles.container, className].filter(Boolean).join(" ")}>
        {headerComponent}
        {children}
        <div className={styles.stickyBottom}>{stickyBottom}</div>
    </div>
};
