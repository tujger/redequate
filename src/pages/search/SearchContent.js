import React from "react";
import {Grid} from "@mui/material";
import {useHistory} from "react-router-dom";
import {useTranslation} from "react-i18next";
import styles from './styles/Search.module.css'

export default () => {
    const history = useHistory();
    const {t} = useTranslation();

    const args = new URLSearchParams(history.location.search.replace(/^\?/, ""));
    return <div className={styles.center}>
        <Grid container>
            {t("Search.Search value: {{value}}", {value: args.get("q")})}
        </Grid>
        <Grid container>
            Search is not yet implemented
        </Grid>
    </div>
}
