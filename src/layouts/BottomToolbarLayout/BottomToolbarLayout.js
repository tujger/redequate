import React from "react";
import PropTypes from "prop-types";
import CssBaseline from "@material-ui/core/CssBaseline";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import BottomToolbar from "./BottomToolbar";
import Titlebar from "./Titlebar";
import MainContent from "../../components/MainContent";
import Snackbar from "../../components/Snackbar";
import {NotificationsSnackbar} from "../../controllers/Notifications";

const styles = theme => ({
    content: {
        ...theme.mixins.toolbar,
    },
    indent: {
        ...theme.mixins.toolbar,
    },
});

function BottomToolbarLayout(props) {
    const {menu, classes} = props;

    return <React.Fragment><CssBaseline/>
        <Titlebar
            {...props}
        />
        <Typography className={classes.indent}/>
        <MainContent classes={{content: classes.content}}/>
        <Typography className={classes.indent}/>
        <BottomToolbar items={menu}/>
        <Snackbar/>
        <NotificationsSnackbar/>
    </React.Fragment>
}

BottomToolbarLayout.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.any,
    firebase: PropTypes.any,
    headerImage: PropTypes.string,
    menu: PropTypes.array,
    pages: PropTypes.object,
    title: PropTypes.string,
};

export default withStyles(styles)(BottomToolbarLayout);
