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
import ProgressView from "./ProgressView";
import {currentRole, matchRole, needAuth, Role, useCurrentUserData} from "../controllers/UserData";
import {connect} from "react-redux";
import {usePages} from "../controllers/General";
import {MenuBadge} from "../controllers/Store";

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
    badge: {
        backgroundColor: "#ff0000",
        borderRadius: theme.spacing(1),
        height: theme.spacing(1),
        left: theme.spacing(1),
        position: "absolute",
        top: theme.spacing(1),
        width: theme.spacing(1)
    },
    badgeWithText: {
        alignItems: "center",
        color: "#ffffff",
        display: "flex",
        fontSize: theme.spacing(1.25),
        fontWeight: "bolder",
        justifyContent: "center",
        height: theme.spacing(2),
        left: theme.spacing(.5),
        top: theme.spacing(.5),
        width: theme.spacing(2),
    }
});

function MainAppbar(props) {
    const {badge, classes, className, onHamburgerClick, label, logo} = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    return <AppBar position="fixed" className={className}>
        <Toolbar>
            {onHamburgerClick ?
                <Hidden mdUp implementation="css">
                    <IconButton
                        aria-label="open drawer"
                        color="inherit"
                        edge="start"
                        onClick={onHamburgerClick}>
                        <Menu/>
                        {badge && badge !== 0 ? <span className={classes.badge}/> : null}
                        {/*
                        {badge && badge !== 0 ? <span
                            className={[classes.badge, badge !== true ? classes.badgeWithText : ""].join(" ")}>{badge !== true ? badge : ""}</span> : null}
*/}
                    </IconButton>
                </Hidden>
                : null}
            <Typography variant="h6" noWrap className={classes.title}>
                <Switch>
                    {itemsFlat.map((item, index) => <Route
                            exact={true}
                            key={index}
                            path={item._route}
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
                <AvatarView
                    admin={currentRole(currentUserData) === Role.ADMIN}
                    image={currentUserData.image}
                    initials={currentUserData.initials}
                    verified={currentUserData.verified}
                />
            </Link>}
        </Toolbar>
        <ProgressView/>
    </AppBar>
}

MainAppbar.propTypes = {
    title: PropTypes.string,
    pages: PropTypes.object,
    onHamburgerClick: PropTypes.func
};

MainAppbar.LABEL = "mainAppBar_Label";

export const mainAppbarReducer = (state = {label: "", badge: 0}, action) => {
    switch (action.type) {
        case MainAppbar.LABEL:
            return {...state, label: action.label};
        case MenuBadge.DECREASE:
            return {...state, badge: (state.badge || 0) - 1};
        case MenuBadge.INCREASE:
            return {...state, badge: (state.badge || 0) + 1};
        case MenuBadge.RESET:
            return {...state, badge: 0};
        default:
            return state;
    }
};
mainAppbarReducer.skipStore = true;

const mapStateToProps = ({mainAppbarReducer}) => ({
    label: mainAppbarReducer.label,
    badge: mainAppbarReducer.badge
});

export default connect(mapStateToProps)(withStyles(styles)(MainAppbar));
