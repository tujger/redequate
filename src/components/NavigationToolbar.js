import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import {useHistory} from "react-router-dom";
import {useTranslation} from "react-i18next";

const styles = theme => ({
    toolbar: {
        minHeight: theme.spacing(5)
    }
})

const NavigationToolbar = props => {
    const {t} = useTranslation();
    const {
        alignItems = "center",
        backButton = <IconButton
            aria-label={t("Common.Back")}
            children={<BackIcon/>}
            /* eslint-disable-next-line no-undef */
            title={t("Common.Back")}
        />,
        children,
        classes,
        className,
        justify,
        mediumButton,
        rightButton,
        style,
    } = props;
    const history = useHistory();

    const button = backButton && <backButton.type
        className={classes.buttonBack}
        onClick={() => history.goBack()}
        style={{color: "inherit"}}
        {...backButton.props}
    />;

    const isChildrenLabel = children && children.constructor.name === "String";

    return <Grid
        alignItems={alignItems}
        className={[classes.toolbar, className].join(" ")}
        container
        style={style}
    >
        <Grid item>
            {button}
        </Grid>
        <Grid item xs>
            <Grid container alignItems={alignItems} justify={justify}>
                {isChildrenLabel ? <Typography variant={"h6"}>{children}</Typography> : children}
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
