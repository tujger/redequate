import React from "react";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import {useHistory} from "react-router-dom";

const styles = theme => ({})

const NavigationToolbar = (
    {
        backButton = <IconButton
            aria-label={"Back"}
            children={<BackIcon/>}
            /* eslint-disable-next-line no-undef */
            onClick={() => history.goBack()}
            title={"Back"}
        />,
        children,
        rightButton,
        mediumButton
    }) => {
    // eslint-disable-next-line no-unused-vars
    const history = useHistory();
    return <Grid container alignItems={"center"}>
        <Grid item>
            {backButton}
        </Grid>
        <Grid item xs>
            {children}
        </Grid>
        {mediumButton && <Grid item>
            {mediumButton}
        </Grid>}
        <Grid item>
            {rightButton}
        </Grid>
    </Grid>
};

export default withStyles(styles)(NavigationToolbar);
