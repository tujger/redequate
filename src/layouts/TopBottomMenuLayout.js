import React from "react";
import PropTypes from "prop-types";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import BottomMenu from "../components/BottomMenu";
import MainContent from "../components/MainContent";
import Snackbar from "../components/Snackbar";
import StickyHeader from "../components/StickyHeader";
import TopMenu from "../components/TopMenu";
import {connect} from "react-redux";
import {Route, Switch} from "react-router-dom";
import {NotificationsSnackbar} from "../controllers/Notifications";
import {usePages} from "../controllers/General";

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
    const {menu, classes, headerImage, random, copyright} = props;
    const pages = usePages();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    return <StickyHeader
        key={random}
        title={<Switch>
            {itemsFlat.map((item, index) => <Route key={index} path={item._route} exact={true} children={item.label}/>)}
        </Switch>}
        headerImage={headerImage}
        sticky={<TopMenu items={menu} className={classes.topmenu}/>}
        stickyClassName={classes.stickytop}
    >
        <MainContent classes={{content: classes.content}}/>
        <Grid container justify="center">
            <BottomMenu items={menu} className={classes.footer}/>
            <Grid container justify="center" className={classes.version}>
                <Typography variant="caption">{copyright}</Typography>
            </Grid>
        </Grid>
        <div className={[classes.stickyBottom].join(" ")}>{null}</div>
        <Snackbar/>
        <NotificationsSnackbar/>
    </StickyHeader>
}

TopBottomMenuLayout.REFRESH = {type: "topBottomMenuLayout_Refresh"};

TopBottomMenuLayout.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.any,
    menu: PropTypes.array,
    pages: PropTypes.object,
    headerImage: PropTypes.string,
    title: PropTypes.string,
};

export const topBottomMenuLayout = (state = {random: 0}, action) => {
    if (action.type === TopBottomMenuLayout.REFRESH.type) {
        return {...state, random: Math.random()};
    } else {
        return state;
    }
};
topBottomMenuLayout.skipStore = true;

const mapStateToProps = ({topBottomMenuLayout}) => ({random: (topBottomMenuLayout || {random: 0}).random});

export default connect(mapStateToProps)(withStyles(styles)(TopBottomMenuLayout));
