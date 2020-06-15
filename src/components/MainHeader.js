import React from "react";
import PropTypes from "prop-types";
import Hidden from "@material-ui/core/Hidden";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import withStyles from "@material-ui/styles/withStyles";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import {Link, Route, Switch} from "react-router-dom";
import {usePages} from "../controllers/General";

const styles = theme => ({
    header: {
        ...theme.mixins.toolbar,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
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
    const {classes, onClick, image, name} = props;
    const pages = usePages();

    return <div className={classes.header} style={{
        backgroundImage: `url(${image})`
    }}>
        <Grid item className={classes.name}>
            <Link to={pages.home.route} className={classes.label}>
            {name}
            </Link>
        </Grid>
        <Hidden mdUp implementation="css">
                    <IconButton onClick={onClick}>
                        <ChevronLeft/>
                    </IconButton>
        </Hidden>
    </div>
};

MainHeader.propTypes = {
    items: PropTypes.array,
    onClick: PropTypes.func
};

export default withStyles(styles)(MainHeader);
