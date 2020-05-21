import React from "react";
import PropTypes from "prop-types";
import CssBaseline from "@material-ui/core/CssBaseline";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import {user} from "../controllers/User";
import BottomToolbar from "../components/BottomToolbar";
import MainTitlebar from "../components/MainTitlebar";
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

function BottomToolbarLayout(props) {
    const {menu, classes, firebase, headerImage, pages, store, copyright, match} = props;

    return <React.Fragment><CssBaseline/>
        <MainTitlebar
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
    </React.Fragment>
}

BottomToolbarLayout.REFRESH = {type: "bottomToolbarLayoutRefresh"};

BottomToolbarLayout.propTypes = {
    container: PropTypes.instanceOf(typeof Element === "undefined" ? Object : Element),
    copyright: PropTypes.any,
    firebase: PropTypes.any,
    headerImage: PropTypes.string,
    menu: PropTypes.array,
    pages: PropTypes.object,
    title: PropTypes.string,
};

export const bottomToolbarLayout = (state = {random: 0}, action) => {
    if (action.type === BottomToolbarLayout.REFRESH.type) {
      return {random: Math.random()};
    } else {
      return state;
    }
};

const mapStateToProps = ({bottomToolbarLayout}) => ({random: bottomToolbarLayout.random});

export default connect(mapStateToProps)(withStyles(styles)(BottomToolbarLayout));
