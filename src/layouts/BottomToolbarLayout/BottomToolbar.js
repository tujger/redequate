import React from "react";
import PropTypes from "prop-types";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import MenuList from "@material-ui/core/MenuList";
import BottomNavigation from "@material-ui/core/BottomNavigation";
import BottomNavigationAction from "@material-ui/core/BottomNavigationAction";
import {Link, matchPath, useHistory, useLocation} from "react-router-dom";
import Popper from "@material-ui/core/Popper";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";

const styles = theme => ({
    bottomtoolbar: {
        bottom: 0,
        left: 0,
        height: theme.spacing(5),
        position: "fixed",
        right: 0,
        zIndex: 2,
    },
    buttonSelected: {
        color: theme.palette.secondary.main,
        "&.Mui-selected": {
            color: theme.palette.secondary.main,
        }
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
        zIndex: 2,
    },
    menuitem: {
        fontSize: "inherit"
    },
    menuitemSelected: {
        backgroundColor: theme.palette.secondary.light,
        color: theme.palette.getContrastText(theme.palette.secondary.light),
    },
    placeholder: {
        opacity: 0,
        position: "relative"
    }
});

const BottomToolbar = props => {

    return <>
        <_BottomToolbar {...props} className={props.classes.placeholder}/>
        <_BottomToolbar {...props}/>
    </>
}

const _BottomToolbar = props => {
    const {items, classes, className} = props;
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

    return <>
        <BottomNavigation
            className={[classes.bottomtoolbar, className].join(" ")}
            onChange={handleChange}
            showLabels
            value={location.pathname}>
            {items.map((list, index) => {
                const [first] = list;
                if (!matchRole(first.roles, currentUserData) || first.disabled) return null;
                const currentItem = list.filter(item => isCurrent(item._route))[0] || first;
console.log(location.pathname === currentItem.route)
                return <BottomNavigationAction
                    icon={currentItem.icon}
                    key={first.route + index}
                    className={location.pathname === currentItem.route ? classes.buttonSelected : ""}
                    // label={currentItem.label}
                    value={currentItem.route}
                    onContextMenu={event => {
                        event.preventDefault();
                        setState({...state, current: first, anchor: event.currentTarget})
                    }}
                />
            })}
        </BottomNavigation>
        {anchor && items.map((list, index) => {
            // eslint-disable-next-line no-unused-vars
            const [first, ...menu] = list;
            const currentItem = list.filter(item => isCurrent(item._route))[0];
            if (!currentItem) return;
            return <Popper
                key={"" + index + Math.random()}
                anchorEl={anchor}
                className={classes.menusection}
                // disablePortal
                onClose={() => setState({...state, current: null, anchor: null})}
                onMouseLeave={() => setState({...state, current: null, anchor: null})}
                open={true}
                placement={"top"}
                role={undefined}>
                <MenuList>{menu.map((item, index) => {
                    if (!matchRole(item.roles, currentUserData) || item.disabled) return null;
                    const child = <MenuItem
                        button
                        children={<>
                            {item.label}
                            {item.adornment && currentUserData ? item.adornment(currentUserData) : null}
                        </>}
                        className={[classes.label, classes.menuitem, isCurrent(item._route) ? classes.menuitemSelected : ""].join(" ")}
                        key={"" + index + Math.random()}
                        onClickCapture={item.onClick}
                    />;
                    if (item.component) {
                        return <Link
                            children={child}
                            className={classes.label}
                            key={"" + index + Math.random()}
                            onClick={() => {
                                setState({...state, current: null, anchor: null})
                            }}
                            to={item.route}
                        />
                    } else {
                        return child
                    }
                })}</MenuList>
            </Popper>
        })}
    </>
};

BottomToolbar.propTypes = {
    children: PropTypes.array,
};

export default withStyles(styles)(BottomToolbar);
