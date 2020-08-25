import React from "react";
import PropTypes from "prop-types";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
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
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.getContrastText(theme.palette.background.paper),
        boxShadow: theme.shadows[4],
    },
    menuitem: {
        fontSize: "inherit"
    },
    menuitemSelected: {
        backgroundColor: theme.palette.secondary.light,
        color: theme.palette.getContrastText(theme.palette.secondary.light),
    },
});

const BottomToolbar = withStyles(styles)(props => {
    const {items, classes} = props;
    const [state, setState] = React.useState({anchor: null});
    const {anchor, current} = state;
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const location = useLocation();

    const isCurrent = (path) => {
        const match = matchPath(current ? current._route : location.pathname, {
            exact: true,
            path: path,
            strict: true
        });
        return !!match;
    }

    const handleChange = (event, newValue) => {
        if (isCurrent(newValue)) {
            setState({...state, current: null, anchor: event.currentTarget});
        } else {
            history.push(newValue);
            setState({...state, current: null, anchor: null});
        }
    };

    return <BottomNavigation
        className={classes.bottomtoolbar}
        onChange={handleChange}
        showLabels
        value={location.pathname}>
        {items.map((list, index) => {
            const [first, ...menu] = list;
            if (!matchRole(first.roles, currentUserData) || first.disabled) return null;
            const currentItem = list.filter(item => isCurrent(item._route))[0] || first;

            return <BottomNavigationAction
                icon={currentItem.icon}
                key={index}
                label={currentItem.label}
                value={currentItem.route}
                onContextMenu={event => {
                    event.preventDefault();
                    setState({...state, current: first, anchor: event.currentTarget})
                }}
            />
        })}
        {items.map((list, index) => {
            const [first, ...menu] = list;
            const currentItem = list.filter(item => isCurrent(item._route))[0];
            if (!currentItem) return;
            return <Popper
                key={index}
                anchorEl={anchor}
                className={classes.menusection}
                disablePortal
                onClose={() => setState({...state, current: null, anchor: null})}
                onMouseLeave={() => setState({...state, current: null, anchor: null})}
                open={Boolean(anchor)}
                placement={"top"}
                role={undefined}>
                <MenuList>{menu.map((item, index) => {
                    if (!matchRole(item.roles, currentUserData) || item.disabled) return null;
                    if (item.component) {
                        return <Link to={item.route}
                                     key={index}
                                     className={classes.label}
                                     onClick={() => {
                                         setState({...state, current: null, anchor: null})
                                     }}>
                            <MenuItem
                                button
                                children={<React.Fragment>
                                    {item.label}
                                    {item.adornment && currentUserData ? item.adornment(currentUserData) : null}
                                </React.Fragment>}
                                className={[classes.menuitem, isCurrent(item._route) ? classes.menuitemSelected : ""].join(" ")}
                                onClickCapture={item.onClick}
                            />
                        </Link>
                    } else {
                        return <MenuItem
                            button
                            children={<React.Fragment>
                                {item.label}
                                {item.adornment && currentUserData ? item.adornment(currentUserData) : null}
                            </React.Fragment>}
                            className={[classes.label, classes.menuitem, isCurrent(item._route) ? classes.menuitemSelected : ""].join(" ")}
                            onClickCapture={item.onClick}
                        />
                    }
                })}</MenuList>
            </Popper>
        })}
    </BottomNavigation>
});

BottomToolbar.propTypes = {
    children: PropTypes.array,
};

export default BottomToolbar;
