import React from "react";
import PropTypes from "prop-types";
import AppBar from "@material-ui/core/AppBar";
import Hidden from "@material-ui/core/Hidden";
import IconButton from "@material-ui/core/IconButton";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import Menu from "@material-ui/icons/Menu";
import {Link, Route, Switch} from "react-router-dom";
import AvatarView from "../components/AvatarView";
import ProgressView from "../components/ProgressView";
import {matchRole, needAuth, useCurrentUserData, currentRole, Role} from "../controllers/UserData";
import {connect} from "react-redux";
import {usePages} from "../controllers/General";
import {SearchToolbar} from "../pages/Search";

const styles = theme => ({
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    title: {
        flex: "1 1 auto"
    },
    logo: {
        alignItems: "center",
        display: "flex",
        flex: "1 1 auto"
    },
    content: {},
    indent: {},
    appbar: {},

});

function MainAppbar(props) {
    const {classes, className, onHamburgerClick, label, logo} = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    return <AppBar position="fixed" className={className}>
        <Toolbar>
            {onHamburgerClick ?
                <Hidden mdUp implementation="css">
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={onHamburgerClick}>
                        <Menu/>
                    </IconButton>
                </Hidden>
                : null}
            <Typography variant="h6" noWrap className={classes.title}>
                <Switch>
                    {itemsFlat.map((item, index) => <Route
                            key={index}
                            path={item._route}
                            exact={true}
                        >
                            <Link to={pages.home.route} className={classes.label}>
                                {logo ? <div className={classes.logo}>
                                        <img src={logo} alt={""}/>
                                    </div> :
                                    (label || (needAuth(item.roles, currentUserData)
                                        ? pages.login.title || pages.login.label : (matchRole(item.roles, currentUserData)
                                            ? item.title || item.label : pages.notfound.title || pages.notfound.label)))
                                }
                            </Link>
                        </Route>
                    )}
                    <Route path={pages.notfound.route}>
                        <Link to={pages.home.route} className={classes.label}>
                            {pages.notfound.title || pages.notfound.label}
                        </Link>
                    </Route>
                </Switch>
            </Typography>
            {pages.search && <pages.search.component.type {...pages.search.component.type.props} toolbar/>}
            {currentUserData.id && <Link to={pages.profile.route} className={classes.label}>
                <AvatarView image={currentUserData.image} initials={currentUserData.initials} verified={currentUserData.verified} admin={currentRole(currentUserData) === Role.ADMIN}/>
            </Link>}
            {/*{user && user.key && <AvatarView user={user} onclick={onavatarclick}/>}*/}
        </Toolbar>
        <ProgressView/>
    </AppBar>
}

MainAppbar.propTypes = {
    title: PropTypes.string,
    pages: PropTypes.object,
    onHamburgerClick: PropTypes.func
};

MainAppbar.LABEL = "mainAppBarLabel";
export const mainAppbar = (state = {label: ""}, action) => {
    if (action.type === MainAppbar.LABEL) {
        return {...state, label: action.label};
    } else {
        return state;
    }
};
mainAppbar.skipStore = true;

const mapStateToProps = ({mainAppbar}) => ({label: mainAppbar.label});

export default connect(mapStateToProps)(withStyles(styles)(MainAppbar));
