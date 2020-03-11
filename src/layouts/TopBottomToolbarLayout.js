import React from "react";
import PropTypes from "prop-types";
import {CssBaseline, Typography, withStyles} from "@material-ui/core";
import {user} from "../controllers/User";
import BottomToolbar from "../components/BottomToolbar";
import MainAppbar from "../components/MainAppbar";
import MainContent from "../components/MainContent";
import Snackbar from "../components/Snackbar";
import {connect} from "react-redux";
import {NotificationsSnackbar} from "../controllers/Notifications";

const styles = theme => ({
    content: {
        ...theme.mixins.toolbar,
    },
    indent: {
        ...theme.mixins.toolbar,
    },
});

function TopBottomToolbarLayout(props) {
    const {menu, classes, firebase, headerImage, pages, store, copyright, match} = props;

    return <div><CssBaseline/>
        <MainAppbar
            {...props}
            pages={pages}
        />
        <Typography className={classes.indent}/>
        <MainContent firebase={firebase} pages={pages} store={store} user={user}
                     classes={{content: classes.content}}/>
        <Typography className={classes.indent}/>
        <BottomToolbar items={menu}/>
        <Snackbar/>
        <NotificationsSnackbar/>
    </div>
}

TopBottomToolbarLayout.REFRESH = {type: "topBottomToolbarLayoutRefresh"};

TopBottomToolbarLayout.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.string,
    firebase: PropTypes.any,
    headerImage: PropTypes.string,
    menu: PropTypes.array,
    pages: PropTypes.object,
    title: PropTypes.string,
};

export const topBottomToolbarLayout = (state = {random: 0}, action) => {
    if (action.type === TopBottomToolbarLayout.REFRESH.type) {
      return {random: Math.random()};
    } else {
      return state;
    }
};

const mapStateToProps = ({topBottomToolbarLayout}) => ({random: topBottomToolbarLayout.random});

export default connect(mapStateToProps)(withStyles(styles)(TopBottomToolbarLayout));
