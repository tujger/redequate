import React from "react";
import styles from "./SelectDivider.module.css";

export default ({className}) => <div
    className={[styles.divider, className].filter(Boolean).join(" ")}
    role={"separator"}
/>;
