import React from "react";
import {Grid} from "@mui/material";
import {Typography} from "@mui/material";

const InfoComponent = ({children, prefix, suffix, variant = "caption", className, style}) => {
    if (!children) return null;
    return <Grid item className={className} style={style}>
        <Typography variant={variant}>
            {prefix} {children} {suffix}
        </Typography>
    </Grid>
}

export default InfoComponent;
