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
import ConfirmComponent from "../../components/ConfirmComponent";
import DispatchedConfirmComponent from "../../components/DispatchedConfirmComponent";
import StickyHeader from "../TopBottomMenuLayout/StickyHeader";

const styles = theme => ({
    container: {
        display: "flex",
        flexDirection: "column",
        position: "relative",
    },
    indent: {
        ...theme.mixins.toolbar,
        minHeight: theme.spacing(5),
    },

    bottom: {
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
        },
    },
    bottomSticky: {
        backgroundColor: theme.palette.background.default,
        bottom: theme.mixins.toolbar.minHeight,
        position: "fixed",
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
        },
    },
    center: {
        display: "flex",
        flex: "1 0 auto",
        flexDirection: "column",
        flexWrap: "nowrap",
        maxWidth: "100%",
        padding: theme.spacing(1),
        // paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        overflow: "auto",
        position: "relative",
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
        },
    },
    left: {},
    right: {},
    top: {
        flex: 0,
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
            paddingTop: theme.spacing(1),
        },
    },
    topSticky: {
        flex: "1 0 auto",
        backgroundColor: theme.palette.background.default,
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        position: "sticky",
        top: theme.spacing(5),
        zIndex: 2,
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
            // paddingTop: theme.spacing(1),
            top: (theme.mixins.toolbar["@media (min-width:600px)"] || {}).minHeight,
        },
    }
});

function BottomToolbarLayout(props) {
    const {classes, footerComponent, menu} = props;

    return <div className={classes.container}>
        <CssBaseline/>
        <Titlebar
            {...props}
            // classes={{}}
        />
        <Typography className={classes.indent}/>
        <MainContent classes={{
            bottom: classes.bottom,
            bottomSticky: classes.bottomSticky,
            center: classes.center,
            left: classes.left,
            right: classes.right,
            topSticky: classes.topSticky,
            top: classes.top
        }}/>
        {footerComponent}
        <BottomToolbar items={menu}/>
        <Snackbar/>
        <NotificationsSnackbar/>
        <DispatchedConfirmComponent open={false}/>
    </div>
}

BottomToolbarLayout.propTypes = {
    container: PropTypes.any,
    copyright: PropTypes.any,
    firebase: PropTypes.any,
    headerImage: PropTypes.string,
    menu: PropTypes.array,
    pages: PropTypes.object,
    title: PropTypes.string,
};

export default withStyles(styles)(BottomToolbarLayout);
