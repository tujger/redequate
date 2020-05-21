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

const styles = theme => ({
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    title: {
        flex: "1 1 auto"
    },
    content: {

    },
    indent: {

    }
});

function MainAppbar(props) {
    const {pages, classes, className, onHamburgerClick} = props;

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
                            path={item.route}
                            exact={true}
                        >
                            <Link to={pages.home.route} className={classes.label}>
                                {needAuth(item.roles, user)
                                    ? pages.login.title || pages.login.label : (matchRole(item.roles, user)
                                        ? item.title || item.label : pages.notfound.title || pages.notfound.label)}
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

export default withStyles(styles)(MainAppbar);
