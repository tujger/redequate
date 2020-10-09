import React from "react";
import Grid from "@material-ui/core/Grid";
import {useHistory} from "react-router-dom";

export default ({classes}) => {
    const history = useHistory();

    const args = new URLSearchParams(history.location.search.replace(/^\?/, ""));
    return <div className={classes.center}>
        <Grid container>
            Search value: {args.get("q")}
        </Grid>
        <Grid container>
            Search is not yet implemented
        </Grid>
    </div>
}
