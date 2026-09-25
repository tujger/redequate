import Grid from "@material-ui/core/Grid";
import React, {forwardRef} from "react";
import postStyles from "./styles/PostComponent.module.css";

export default forwardRef((props, ref) => {
    const classes = {...postStyles, ...(props.classes || {})};

    return <Grid className={[classes.text, classes.ancillaryText].join(" ")} ref={ref} container/>
})
