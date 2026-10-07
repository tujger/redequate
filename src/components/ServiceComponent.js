import React from "react";
import styles from "./styles/ServiceComponent.module.css";

export default props => {
    const {text} = props;
    return <div className={styles.item}>
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.subheader}>{text}</div>
            </div>
        </div>
    </div>
};
