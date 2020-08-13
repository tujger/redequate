import React from "react";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import withStyles from "@material-ui/styles/withStyles";
import {useTechnicalInfo} from "../controllers";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import FixIcon from "@material-ui/icons/BugReport";
import EditIcon from "@material-ui/icons/Edit";

const styles = theme => ({})

const NavigationToolbar =
    ({
         backButton = <IconButton
             aria-label={"Back"}
             children={<BackIcon/>}
             onClick={() => history.goBack()}
             title={"Back"}
         />, rightButton, mediumButton
     }) => {
        return <Grid container>
            <Grid item>
                {backButton}
            </Grid>
            <Grid item xs/>
            {mediumButton}
            <Grid item>
                {rightButton}
            </Grid>
        </Grid>
    };

export default withStyles(styles)(NavigationToolbar);
