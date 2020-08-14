import React from "react";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import {useHistory} from "react-router-dom";

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
        const history = useHistory();
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
