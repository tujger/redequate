import React from "react";
import PropTypes from "prop-types";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import BottomMenu from "./BottomMenu";
import MainContent from "../../components/MainContent";
import Snackbar from "../../components/Snackbar";
import StickyHeader from "./StickyHeader";
import TopMenu from "./TopMenu";
import {Route, Switch} from "react-router-dom";
import {NotificationsSnackbar, notifySnackbar} from "../../controllers/Notifications";
import {enableDisabledPages, usePages, useStore} from "../../controllers/General";
import HeaderComponent from "../../components/HeaderComponent";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {refreshAll} from "../../controllers/Store";

const styles = theme => ({
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
        backgroundColor: "#ffffff88",
    },
    headertitle: {},
    headerlabel: {
        margin: theme.spacing(1),
    },
    footer: {
        position: "sticky",
        bottom: 0,
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

});

function TopBottomMenuLayout(props) {
    const {menu, classes, title, headerComponent = <HeaderComponent/>, random, copyright} = props;
    const currentUserData = useCurrentUserData();
    const pages = usePages();
    const store = useStore();

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
        <MainContent classes={{content: classes.content}}/>
        <Grid container justify={"center"}>
            <BottomMenu items={menu} className={classes.footer}/>
            <Grid container justify={"center"} className={classes.version} onContextMenu={event => {
                if (!matchRole(Role.ADMIN, currentUserData)) return;
                const count = enableDisabledPages();
                if (count) {
                    event.preventDefault();
                    refreshAll(store);
                    notifySnackbar(`Temporarily emabled ${count} hidden page(s)`)
                }
            }}>
                <Typography variant={"caption"}>{copyright}</Typography>
            </Grid>
        </Grid>
        <div className={[classes.stickyBottom].join(" ")}>{null}</div>
        <Snackbar/>
        <NotificationsSnackbar/>
    </StickyHeader>
}

TopBottomMenuLayout.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.any,
    menu: PropTypes.array,
    pages: PropTypes.object,
    headerComponent: PropTypes.element,
    title: PropTypes.string,
};

export default withStyles(styles)(TopBottomMenuLayout);
