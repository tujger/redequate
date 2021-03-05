import React from "react";
import PropTypes from "prop-types";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import {Route, Switch} from "react-router-dom";
import {useTranslation} from "react-i18next";
import BottomMenu from "./BottomMenu";
import MainContent from "../../components/MainContent";
import Snackbar from "../../components/Snackbar";
import StickyHeader from "./StickyHeader";
import TopMenu from "./TopMenu";
import {NotificationsSnackbar} from "../../controllers/Notifications";
import {enableDisabledPages, usePages, useStore} from "../../controllers/General";
import HeaderComponent from "../../components/HeaderComponent";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {refreshAll} from "../../controllers/Store";
import notifySnackbar from "../../controllers/notifySnackbar";
import DispatchedConfirmComponent from "../../components/DispatchedConfirmComponent";

const stylesCurrent = theme => ({
    indent: {
        ...theme.typography.button,
        height: "2.5rem",
    },
    content: {
        paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        paddingRight: theme.overrides.MuiDrawer.paperAnchorLeft.width,
    },
    headercontainer: {
        position: "relative",
        // height: 150,
    },
    stickytop: {
        justifyContent: "flex-end",
    },
    topmenu: {
        ...theme.typography.button,
        backgroundColor: "#ffffff88",
        alignItems: "center",
        display: "flex",
        zIndex: 2,
        ...theme.fetchOverride(theme => theme.customized.topBottomLayout.topmenu),
    },

    headertitle: {},
    headerlabel: {
        margin: theme.spacing(1),
    },
    footer: {
        flexBasis: theme.mixins.toolbar.minHeight,
        flexGrow: 0,
        flexShrink: 0,
    },
    version: {
        backgroundColor: theme.palette.background.default,
    },
    progress: {
        marginBottom: -4,
    },
    stickyBottom: {
        position: "sticky",
        bottom: 0
    },

    bottom: {},
    bottomSticky: {
        backgroundColor: theme.palette.background.default,
        bottom: 0,
        paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        paddingRight: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        position: "sticky",
    },
    center: {
        display: "flex",
        flex: "1 1 auto",
        flexDirection: "column",
        flexWrap: "nowrap",
        maxWidth: "100%",
        overflow: "auto",
        padding: theme.spacing(1),
        paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        paddingRight: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        position: "relative",
    },
    left: {},
    right: {},
    top: {
        paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        paddingRight: theme.overrides.MuiDrawer.paperAnchorLeft.width,
    },
    topSticky: {
        backgroundColor: "inherit",
        paddingLeft: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        paddingRight: theme.overrides.MuiDrawer.paperAnchorLeft.width,
        position: "sticky",
        zIndex: 2,
        ...theme.fetchOverride(theme => theme.customized.topBottomLayout.topSticky),
    }
});

function TopBottomMenuLayout(props) {
    const {menu, classes, title, footerComponent, headerComponent = <HeaderComponent/>, random, copyright} = props;
    const {t} = useTranslation();
    const currentUserData = useCurrentUserData();
    const pages = usePages();
    const store = useStore();
    let counter = 0;

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    return <StickyHeader
        key={random}
        title={<Switch>
            {itemsFlat.map((item, index) => <Route key={index} path={item._route} exact={true} children={item.label}/>)}
        </Switch>}
        headerComponent={<headerComponent.type
            {...headerComponent.props}
            menuComponent={<TopMenu items={menu} className={[classes.topmenu, classes.stickytop].join(" ")}/>}
            title={title}
            wide
        />}
        menuClassName={classes.stickytop}
    >
        <MainContent classes={{
            bottom: classes.bottom,
            bottomSticky: classes.bottomSticky,
            center: classes.center,
            left: classes.left,
            right: classes.right,
            topSticky: classes.topSticky,
            top: classes.top
        }}/>
        <Grid container className={classes.footer} justify={"center"}>
            <BottomMenu items={menu}/>
            <Grid
                container
                justify={"center"}
                className={classes.version}
                onClick={event => {
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
            </Grid>
        </Grid>
        <div className={[classes.stickyBottom].join(" ")}>{null}</div>
        {footerComponent}
        <Snackbar/>
        <NotificationsSnackbar/>
        <DispatchedConfirmComponent open={false}/>
    </StickyHeader>
}

TopBottomMenuLayout.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.any,
    menu: PropTypes.array,
    pages: PropTypes.object,
    headerComponent: PropTypes.element,
    title: PropTypes.any,
};

export default withStyles(stylesCurrent)(TopBottomMenuLayout);
