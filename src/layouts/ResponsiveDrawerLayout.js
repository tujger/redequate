import React from "react";
import PropTypes from "prop-types";
import Box from "@material-ui/core/Box";
import CssBaseline from "@material-ui/core/CssBaseline";
import Divider from "@material-ui/core/Divider";
import Drawer from "@material-ui/core/Drawer";
import Grid from "@material-ui/core/Grid";
import Hidden from "@material-ui/core/Hidden";
import SwipeableDrawer from "@material-ui/core/SwipeableDrawer";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import MainAppbar from "../components/MainAppbar";
import MainContent from "../components/MainContent";
import MainHeader from "../components/MainHeader";
import MainMenu from "../components/MainMenu";
import Snackbar from "../components/Snackbar";
import {connect} from "react-redux";
import {NotificationsSnackbar} from "../controllers/Notifications";
import {useFirebase, usePages, useStore, useWindowData} from "../controllers/General";

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
    },
    appbar: {
        [theme.breakpoints.up("md")]: {
            width: `calc(100% - ${theme.drawerWidth}px)`,
            marginLeft: theme.drawerWidth,
        }
    }
});

function ResponsiveDrawerLayout(props) {
    const {container, menu, classes, headerImage, copyright, name} = props;
    const [state, setState] = React.useState({mobileOpen: false, key: Math.random()});
    const {mobileOpen} = state;
    const pages = usePages();
    const store = useStore();
    const firebase = useFirebase();
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

    console.log(windowData.isNarrow())
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
                <MainHeader image={headerImage}
                            name={name}
                            onClick={() => setState({...state, mobileOpen: false})}
                            pages={pages}
                />
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
                <MainHeader image={headerImage}
                            name={name}
                            onClick={() => setState({...state, mobileOpen: false})}
                            pages={pages}
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
            onHamburgerClick={handleDrawerToggle}
        />
        <Typography className={classes.indent}/>
        <MainContent classes={{content: classes.content}}/>
        <Snackbar/>
        <NotificationsSnackbar/>
    </React.Fragment>
}

ResponsiveDrawerLayout.REFRESH = {type: "responsiveDrawerLayoutRefresh"};

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

export const responsiveDrawerLayout = (state = {random: 0}, action) => {
    if (action.type === ResponsiveDrawerLayout.REFRESH.type) {
        return {random: Math.random()};
    } else {
        return state;
    }
};
responsiveDrawerLayout.skipStore = true;

const mapStateToProps = ({responsiveDrawerLayout}) => ({random: responsiveDrawerLayout.random});

export default connect(mapStateToProps)(withStyles(styles)(ResponsiveDrawerLayout));
