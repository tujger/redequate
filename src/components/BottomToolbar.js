import React from "react";
import PropTypes from "prop-types";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import {matchRole, user} from "../controllers/User";
import MenuList from "@material-ui/core/MenuList";
import BottomNavigation from "@material-ui/core/BottomNavigation";
import BottomNavigationAction from "@material-ui/core/BottomNavigationAction";
import {Link, matchPath, useHistory, useLocation} from "react-router-dom";
import Popper from "@material-ui/core/Popper";

const styles = theme => ({
    bottomtoolbar: {
        bottom: 0,
        left: 0,
        position: "fixed",
        right: 0
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    menusection: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.getContrastText(theme.palette.background.default),
        boxShadow: theme.shadows[1],
    },
    menuitem: {
        fontSize: "inherit"
    },
});

const BottomToolbar = withStyles(styles)(props => {
    const {items, classes, match} = props;
    const [state, setState] = React.useState({anchor: null});
    const {anchor} = state;
    const location = useLocation();
    const history = useHistory();


    const handleChange = (event, newValue) => {
        if (matchPath(newValue, match).url === location.pathname) {
            setState({...state, anchor: event.currentTarget});
        } else {
            history.push(newValue);
            setState({...state, anchor: null});
        }
    };

    return <BottomNavigation className={classes.bottomtoolbar} value={location.pathname}
                             onChange={handleChange} showLabels>
        {items.map((list, index) => {
            const [first, ...menu] = list;
            if (!matchRole(first.roles, user)) return null;

            const currentItem = menu.filter(item => item.route === location.pathname)[0] || first;
            return <BottomNavigationAction
                key={index}
                label={currentItem.label} icon={currentItem.icon}
                value={currentItem.route}
            />
            // <NavSection key={index} items={list}/>
        })}
        {items.map((list, index) => {
            const [first, ...menu] = list;
            const currentItem = menu.filter(item => item.route === location.pathname)[0] || first;
            if (currentItem.route !== location.pathname) return null;
            if (!matchRole(currentItem.roles, user)) return null;
            return <Popper
                key={index}
                anchorEl={anchor}
                className={classes.menusection}
                disablePortal
                onClose={() => setState({...state, anchor: null})}
                onMouseLeave={() => setState({...state, anchor: null})}
                open={Boolean(anchor)}
                placement={"top"}
                role={undefined}>
                <MenuList>{menu.map((item, index) => {
                    if (!matchRole(item.roles, user)) return null;
                    return <Link to={item.route}
                                 key={index}
                                 className={classes.label}
                                 onClick={() => {
                                     setState({...state, anchor: null})
                                 }}>
                        <MenuItem
                            button
                            children={item.label}
                            className={classes.menuitem}
                            key={item.id}/>
                    </Link>
                })}</MenuList>
            </Popper>
        })}
    </BottomNavigation>
});

BottomToolbar.propTypes = {
    children: PropTypes.array,
};

export default BottomToolbar;
