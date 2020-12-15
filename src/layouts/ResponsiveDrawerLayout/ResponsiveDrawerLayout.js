import React from "react";
import PropTypes from "prop-types";
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
import {enableDisabledPages, useStore, useWindowData} from "../../controllers/General";
import IconButton from "@material-ui/core/IconButton";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import Hidden from "@material-ui/core/Hidden";
import HeaderComponent from "../../components/HeaderComponent";
import {hasWrapperControlInterface, wrapperControlCall} from "../../controllers/WrapperControl";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {refreshAll} from "../../controllers/Store";
import {notifySnackbar} from "../../controllers/notifySnackbar";
import ConfirmComponent from "../../components/ConfirmComponent";
import DispatchedConfirmComponent from "../../components/DispatchedConfirmComponent";
import StickyHeader from "../TopBottomMenuLayout/StickyHeader";
import {useTranslation} from "react-i18next";

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

let onpopstateBackup;

const styles = theme => ({
    container: {
        display: "flex",
        flexDirection: "column",
        position: "relative",
    },
    // center: {
    //     ...theme.mixins.toolbar,
    //     [theme.breakpoints.up("md")]: {
    //         marginLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
    //     },
    // },
    indent: {
        ...theme.mixins.toolbar,
        height: theme.mixins.toolbar.minHeight,
    },
    appbar: {
        [theme.breakpoints.up("md")]: {
            // width: `calc(100% - ${theme.drawerWidth}px)`,
            marginLeft: theme.drawerWidth,
        }
    },
    headerMenu: {
        position: "absolute",
        right: 0,
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
        bottom: 0,
        position: "fixed",
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
        },
    },
    center: {
        display: "flex",
        flex: "0 0 auto",
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
        flex: "0 0 auto",
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
            paddingTop: theme.spacing(1),
        },
    },
    topSticky: {
        flex: "0 0 auto",
        backgroundColor: theme.palette.background.default,
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        position: "sticky",
        top: theme.mixins.toolbar.minHeight,
        zIndex: 2,
        [theme.breakpoints.up("md")]: {
            paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width + theme.spacing(1),
            // paddingTop: theme.spacing(1),
            top: (theme.mixins.toolbar["@media (min-width:600px)"] || {}).minHeight,
        },
    }
});

function ResponsiveDrawerLayout(props) {
    const {container, footerComponent, menu, classes, title, headerComponent = <HeaderComponent/>, copyright} = props;
    const [state, setState] = React.useState({mobileOpen: false, key: Math.random()});
    const {mobileOpen} = state;
    const {t} = useTranslation();
    const currentUserData = useCurrentUserData();
    const store = useStore();
    const windowData = useWindowData();
    let counter = 0;

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
    hasWrapperControlInterface() && wrapperControlCall({
        method: "swipeable",
        value: !mobileOpen
    }).catch(notifySnackbar);

    const copyrightElement = <Grid container justify={"center"} onClick={event => {
        if (!matchRole(Role.ADMIN, currentUserData)) return;
        counter++;
        if (counter === 3) {
            const count = enableDisabledPages();
            if (count) {
                event.preventDefault();
                refreshAll(store);
                notifySnackbar(t(`Admin.Temporarily enabled ${count} hidden page(s)`))
            }
        }
    }}>
        <Typography variant={"caption"}>{copyright}</Typography>
    </Grid>;

    return <div className={classes.container}>
        <CssBaseline/>
        {windowData.isNarrow()
            ? <SwipeableDrawer
                container={container}
                variant={"temporary"}
                anchor={"left"}
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{
                    // keepMounted: true, // Better open performance on mobile.
                }}
                disableBackdropTransition={!iOS} disableDiscovery={iOS}
                onOpen={handleDrawerToggle}>
                <headerComponent.type
                    {...headerComponent.props}
                    narrow
                    title={title}
                />
                <Hidden mdUp implementation={"css"} className={classes.headerMenu}>
                    <IconButton onClick={() => setState({...state, mobileOpen: false})}>
                        <ChevronLeft/>
                    </IconButton>
                </Hidden>
                <Divider/>
                <MainMenu items={menu} onClick={() => {
                    // dispatch(ProgressView.SHOW);
                    setState({...state, mobileOpen: false})
                }}/>
                {copyrightElement}
            </SwipeableDrawer>
            : <Drawer variant={"permanent"} open>
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
                {copyrightElement}
            </Drawer>
        }
        <MainAppbar
            className={classes.appbar}
            {...props}
            classes={{}}
            onHamburgerClick={handleDrawerToggle}
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
        <Snackbar/>
        <NotificationsSnackbar/>
        <DispatchedConfirmComponent open={false}/>
    </div>
}

ResponsiveDrawerLayout.propTypes = {
    classes: PropTypes.any,
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
