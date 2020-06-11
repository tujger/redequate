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
import {matchRole, needAuth, user} from "../controllers/User";
import {connect} from "react-redux";
import {usePages} from "../controllers";

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
    appbar: {}
});

function MainAppbar(props) {
    const {classes, className, onHamburgerClick, label, logo} = props;
    const pages = usePages();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    console.log(label)
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
            {logo ?
                <div className={classes.logo}>
                    <img src={logo} alt={""}/>
                </div>
            : <Typography variant="h6" noWrap className={classes.title}>
                <Switch>
                    {itemsFlat.map((item, index) => <Route
                            key={index}
                            path={item.route}
                            exact={true}
                        >
                            <Link to={pages.home.route} className={classes.label}>
                                {label || (needAuth(item.roles, user)
                                    ? pages.login.title || pages.login.label : (matchRole(item.roles, user)
                                        ? item.title || item.label : pages.notfound.title || pages.notfound.label))}
                            </Link>
                        </Route>
                    )}
                    <Route path={pages.notfound.route}>
                        <Link to={pages.home.route} className={classes.label}>
                            {pages.notfound.title || pages.notfound.label}
                        </Link>
                    </Route>
                </Switch>
            </Typography>}
            {user.uid() && <Link to={pages.profile.route} className={classes.label}>
                <AvatarView user={user}/>
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

MainAppbar.LABEL = "label";
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
