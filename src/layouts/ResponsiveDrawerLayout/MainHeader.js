import React from "react";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import {Link} from "react-router-dom";
import {usePages} from "../../controllers/General";

const styles = theme => ({
    header: {
        ...theme.mixins.toolbar,
        backgroundColor: theme.palette.secondary.main,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        color: theme.palette.secondary.contrastText,
        height: 120,
        justifyContent: "space-between",
        [theme.breakpoints.up("md")]: {
            display: "flex",
        },
        [theme.breakpoints.down("md")]: {
            alignItems: "flex-start",
            display: "flex",
        },
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    name: {
        fontSize: theme.spacing(3),
        fontWeight: "bolder",
        marginLeft: theme.spacing(2),
        marginTop: theme.spacing(2),
    }
});

const MainHeader = props => {
    // eslint-disable-next-line react/prop-types
    const {classes, title, image} = props;
    const pages = usePages();

    return <div
        className={classes.header}
        style={image ? {
            backgroundImage: `url(${image})`
        } : null}>
        <Grid item className={classes.name}>
            <Link to={pages.home.route} className={classes.label}>
                {title}
            </Link>
        </Grid>
    </div>
};

export default withStyles(styles)(MainHeader);
