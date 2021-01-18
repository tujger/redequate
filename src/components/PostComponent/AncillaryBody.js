import React, {forwardRef} from "react";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import {stylesList} from "../../controllers/Theme";

const classesCurrent = theme => ({
    text: {
        color: "gray",
        display: "inline-block",
        marginTop: theme.spacing(2),
        overflowWrap: "break-word",
        paddingLeft: theme.spacing(3),
        whiteSpace: "pre-wrap",
        wordWrap: "break-word",
    }
})

export default withStyles(theme => ({
    ...stylesList(theme),
    ...classesCurrent(theme)
}))(forwardRef(({classes}, ref) => {
    return <Grid className={classes.text} ref={ref} container>

    </Grid>
}))
