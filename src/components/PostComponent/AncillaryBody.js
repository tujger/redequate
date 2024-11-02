import {Grid} from "@mui/material";
import React, {forwardRef} from "react";
import styles from "./styles/PostComponent.module.css";

export default forwardRef(({classes}, ref) => {
    return <Grid className={styles.text} ref={ref} container/>
})
