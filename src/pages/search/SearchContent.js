import React from "react";
import Grid from "@material-ui/core/Grid";
import {useHistory} from "react-router-dom";
import {useTranslation} from "react-i18next";

export default ({classes}) => {
    const history = useHistory();
    const {t} = useTranslation();

    const args = new URLSearchParams(history.location.search.replace(/^\?/, ""));
    return <div className={classes.center}>
        <Grid container>
            {t("Search.Search value: {{value}}", {value: args.get("q")})}
        </Grid>
        <Grid container>
            Search is not yet implemented
        </Grid>
    </div>
}
