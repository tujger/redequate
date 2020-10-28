import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

const InfoComponent = ({children, prefix, suffix, variant = "caption", className}) => {
    if (!children) return null;
    return <Grid item className={className}>
        <Typography variant={variant}>
            {prefix} {children} {suffix}
        </Typography>
    </Grid>
}

export default InfoComponent;
