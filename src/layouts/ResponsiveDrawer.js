import React from "react";
import PropTypes from "prop-types";
import {
    Box,
    CssBaseline,
    Divider,
    Drawer,
    Grid,
    Hidden,
    SwipeableDrawer,
    Typography,
    withStyles
} from "@material-ui/core";
import MainAppbar from "../components/MainAppbar";
import MainContent from "../components/MainContent";
import MainHeader from "../components/MainHeader";
import MainMenu from "../components/MainMenu";
import Snackbar from "../components/Snackbar";
import {user} from "../controllers/User";
import {connect} from "react-redux";

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);
window.history.pushState(null, null, window.location.href);

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

});

function ResponsiveDrawer(props) {
    const {container, menu, classes, firebase, headerImage, pages, store, copyright} = props;
    const [state, setState] = React.useState({mobileOpen: false, key: Math.random()});
    const {mobileOpen} = state;

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

    return <div><CssBaseline/>
        <Hidden mdUp implementation="css">
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
                            onClick={() => setState({...state, mobileOpen: false})}/>
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
        </Hidden>
        <Hidden smDown implementation="css">
            <Drawer
                variant="permanent"
                open>
                <MainHeader image={headerImage}
                            onClick={() => setState({...state, mobileOpen: false})}/>
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
        </Hidden>
        <MainAppbar
            {...props}
            pages={pages}
            onHamburgerClick={handleDrawerToggle}
        />
        <Typography className={classes.indent}/>
        <MainContent firebase={firebase} pages={pages} store={store} user={user}
                     classes={{content: classes.content}}/>
        <Snackbar/>
    </div>
}

ResponsiveDrawer.REFRESH = {type: "responsiveDrawerRefresh"};

ResponsiveDrawer.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.string,
    firebase: PropTypes.any,
    headerImage: PropTypes.string,
    menu: PropTypes.array,
    pages: PropTypes.object,
    title: PropTypes.string,
};

export const responsiveDrawer = (state = {random: 0}, action) => {
    switch (action.type) {
        case ResponsiveDrawer.REFRESH.type:
            return {random: Math.random()};
        default:
            return state;
    }
};

const mapStateToProps = ({responsiveDrawer}) => ({random: responsiveDrawer.random});

export default connect(mapStateToProps)(withStyles(styles)(ResponsiveDrawer));
