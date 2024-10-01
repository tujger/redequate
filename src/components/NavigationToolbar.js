import React from "react";
import {Grid} from "@mui/material";
import {Typography} from "@mui/material";
import {withStyles} from "@mui/styles";
import {IconButton} from "@mui/material";
import BackIcon from "@mui/icons-material/ArrowBack";
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
