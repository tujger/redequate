import React from "react";
import PropTypes from "prop-types";
import Box from "@material-ui/core/Box";
import CssBaseline from "@material-ui/core/CssBaseline";
import Divider from "@material-ui/core/Divider";
import Drawer from "@material-ui/core/Drawer";
import Grid from "@material-ui/core/Grid";
import SwipeableDrawer from "@material-ui/core/SwipeableDrawer";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import MainAppbar from "./MainAppbar";
import MainContent from "../../components/MainContent";
import MainMenu from "./MainMenu";
import Snackbar from "../../components/Snackbar";
import {NotificationsSnackbar} from "../../controllers/Notifications";
import {useWindowData} from "../../controllers/General";
import IconButton from "@material-ui/core/IconButton";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import Hidden from "@material-ui/core/Hidden";
import HeaderComponent from "../../components/HeaderComponent";

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

let onpopstateBackup;

const styles = theme => ({
    content: {
        ...theme.mixins.toolbar,
        [theme.breakpoints.up("md")]: {
            marginLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        },
    },
    indent: {
        ...theme.mixins.toolbar,
        height: theme.mixins.toolbar.minHeight,
    },
    appbar: {
        [theme.breakpoints.up("md")]: {
            width: `calc(100% - ${theme.drawerWidth}px)`,
            marginLeft: theme.drawerWidth,
        }
    },
    headerMenu: {
        position: "absolute",
        right: 0,
    }
});

function ResponsiveDrawerLayout(props) {
    const {container, menu, classes, title, headerComponent = <HeaderComponent/>, copyright} = props;
    const [state, setState] = React.useState({mobileOpen: false, key: Math.random()});
    const {mobileOpen} = state;
    const windowData = useWindowData();

    const handleDrawerToggle = () => {
        setState({...state, mobileOpen: !mobileOpen});
    };
    if (mobileOpen) {
        onpopstateBackup = window.onpopstate;
        window.onpopstate = () => {
            window.onpopstate = onpopstateBackup;
            setState({...state, mobileOpen: false});
            window.history.go(1);
        }
    } else if (onpopstateBackup !== undefined) {
        window.onpopstate = onpopstateBackup;
        onpopstateBackup = null;
    }

    return <React.Fragment><CssBaseline/>
        {windowData.isNarrow() ?
            <SwipeableDrawer
                container={container}
                variant="temporary"
                anchor={"left"}
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{
                    keepMounted: true, // Better open performance on mobile.
                }}
                disableBackdropTransition={!iOS} disableDiscovery={iOS}
                onOpen={handleDrawerToggle}>
                <headerComponent.type
                    {...headerComponent.props}
                    narrow
                    title={title}
                />
                <Hidden mdUp implementation="css" className={classes.headerMenu}>
                    <IconButton onClick={() => setState({...state, mobileOpen: false})}>
                        <ChevronLeft/>
                    </IconButton>
                </Hidden>
                <Divider/>
                <MainMenu items={menu} onClick={() => {
                    // dispatch(ProgressView.SHOW);
                    setState({...state, mobileOpen: false})
                }}/>
                <Grid container justify="center">
                    <Box m={1}/>
                    <Typography variant="caption">{copyright}</Typography>
                </Grid>
            </SwipeableDrawer>
            :
            <Drawer variant="permanent" open>
                <headerComponent.type
                    {...headerComponent.props}
                    narrow
                    title={title}
                />
                <Divider/>
                <MainMenu items={menu} onClick={(ev) => {
                    // dispatch(ProgressView.SHOW);
                    setState({...state, mobileOpen: false})
                }}/>
                <Grid container justify="center">
                    <Box m={1}/>
                    <Typography variant="caption">{copyright}</Typography>
                </Grid>
            </Drawer>
        }
        <MainAppbar
            className={classes.appbar}
            {...props}
            classes={{}}
            onHamburgerClick={handleDrawerToggle}
        />
        <Typography className={classes.indent}/>
        <MainContent classes={{content: classes.content}}/>
        <Snackbar/>
        <NotificationsSnackbar/>
    </React.Fragment>
}

ResponsiveDrawerLayout.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.any,
    firebase: PropTypes.any,
    headerImage: PropTypes.string,
    menu: PropTypes.array,
    name: PropTypes.string,
    pages: PropTypes.object,
    title: PropTypes.string,
};

export default withStyles(styles)(ResponsiveDrawerLayout);