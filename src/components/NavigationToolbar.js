import React from "react";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import {useHistory} from "react-router-dom";

const styles = theme => ({
    toolbar: {
        minHeight: theme.spacing(5)
    }
})

const NavigationToolbar = (
    {
        alignItems = "center",
        backButton = <IconButton
            aria-label={"Back"}
            children={<BackIcon/>}
            /* eslint-disable-next-line no-undef */
            title={"Back"}
        />,
        children,
        classes,
        className,
        justify,
        rightButton,
        mediumButton
    }) => {
    const history = useHistory();

    const button = backButton && <backButton.type
        className={classes.buttonBack}
        onClick={() => history.goBack()}
        {...backButton.props}
    />;
console.log(classes)
    return <Grid container className={[classes.toolbar, className].join(" ")} alignItems={alignItems}>
        <Grid item>
            {button}
        </Grid>
        <Grid item xs>
            <Grid container alignItems={alignItems} justify={justify}>
                {children}
            </Grid>
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
