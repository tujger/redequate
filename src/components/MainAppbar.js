import React from "react";
import PropTypes from "prop-types";
import {AppBar, Hidden, IconButton, Toolbar, Typography, withStyles} from "@material-ui/core";
import {Menu} from "@material-ui/icons";
import {Link, Switch} from "react-router-dom";
import Route from "react-router-hooks";
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
                                {needAuth(item.roles, user.currentUser())
                                    ? pages.login.title || pages.login.label : (matchRole(item.roles, user.currentUser())
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
            {user.currentUser() && <Link to={pages.profile.route} className={classes.label}>
                <AvatarView user={user.currentUser()}/>
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