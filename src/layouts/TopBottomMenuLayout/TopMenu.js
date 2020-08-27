import React from "react";
import PropTypes from "prop-types";
import {MenuItem, withStyles} from "@material-ui/core";
import {currentRole, matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {Link, useHistory} from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Popper from "@material-ui/core/Popper";
import MenuList from "@material-ui/core/MenuList";
import AvatarView from "../../components/AvatarView";
import {MenuBadge, usePages} from "../../controllers/General";
import {connect} from "react-redux";

const styles = theme => ({
    badge: {
        backgroundColor: "#ff0000",
        borderRadius: theme.spacing(1),
        height: theme.spacing(1),
        right: theme.spacing(0.5),
        position: "absolute",
        top: theme.spacing(0.5),
        width: theme.spacing(1)
    },
    header: {
        ...theme.typography.button,
        display: "flex",
    },
    indent: {
        ...theme.typography.button,
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    topmenu: {
        ...theme.typography.button,
        alignItems: "center",
        backgroundColor: "transparent",
        display: "flex",
        // position: "fixed",
        // left: 0,
        // right: 0,
        // top: 0,
        zIndex: 1,
    },
    menusection: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.getContrastText(theme.palette.background.default),
        boxShadow: theme.shadows[2],
    },
    menuitem: {
        fontSize: "inherit"
    },
    profileitem: {
        // marginLeft: "auto",
        margin: theme.spacing(0.5),
    }
});

const MenuSection = withStyles(styles)(props => {
    const {badge, items, classes} = props;
    const [first, ...menu] = items;
    const [state, setState] = React.useState({anchor: null});
    const {anchor} = state;
    const history = useHistory();
    const currentUserData = useCurrentUserData();

    if (!matchRole(first.roles, currentUserData)) return null;

    const checkForBadge = () => {
        return menu.filter(item => !!badge[item.route]).length > 0;
    }
    const hasBadge = checkForBadge();

    return <Button
        className={"MuiTopMenu-section"}
        onClickCapture={ev => setState({...state, anchor: ev.currentTarget})}
        onClick={() => {
            history.push(first.route);
        }}
        onMouseEnter={ev => setState({...state, anchor: ev.currentTarget})}
        onMouseLeave={() => setState({...state, anchor: null})}
        variant={"text"}>
        {first.label}
        {hasBadge && <span className={classes.badge}/>}
        <Popper
            anchorEl={anchor}
            // className={classes.menusection}
            disablePortal
            onClose={() => setState({...state, anchor: null})}
            open={Boolean(anchor)}
            placement={"bottom-end"}
            role={undefined}>
            <Paper>
                <MenuList
                    className={classes.menusection}
                >
                    {menu.map((item, index) => {
                        if (!matchRole(item.roles, currentUserData) || item.disabled) return null;
                        const child = <MenuItem
                            button
                            children={<React.Fragment>
                                {item.label}
                                {item.adornment && currentUserData && item.adornment(currentUserData)}
                            </React.Fragment>}
                            className={[classes.label, classes.menuitem].join(" ")}
                            key={index}
                            onClickCapture={item.onClick}
                        />;
                        if (item.component) {
                            return <Link
                                children={child}
                                key={index}
                                className={classes.label}
                                onClick={(event) => {
                                    setState({...state, anchor: null});
                                    event && event.stopPropagation();
                                    // event && event.preventDefault();
                                }}
                                to={item.route}
                            />
                        } else {
                            return child
                        }
                    })}
                </MenuList>
            </Paper>
        </Popper>
    </Button>
});

const TopMenu = props => {
    const {badge = {}, items, classes, className} = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();

    return <div className={["MuiTopMenu-root", classes.topmenu, className].join(" ")}>
        {items.map((list, index) => <MenuSection key={index} badge={badge} items={list}/>)}
        {pages.search && <pages.search.component.type {...pages.search.component.type.props} toolbar/>}
        {currentUserData.id && <Link
            to={pages.profile.route}
            className={[classes.label, classes.profileitem].join(" ")}>
            <AvatarView
                admin={currentRole(currentUserData) === Role.ADMIN}
                image={currentUserData.image}
                initials={currentUserData.initials}
                verified={currentUserData.verified}
            />
        </Link>}
    </div>
};

TopMenu.propTypes = {
    children: PropTypes.array,
    className: PropTypes.string,
    items: PropTypes.array,
    pages: PropTypes.object,
};

export const topMenuReducer = (state = {page: null, badge: {}}, action) => {
    switch (action.type) {
        case MenuBadge.INCREASE:
            const id = action.page.route;
            return {...state, badge: {...state.badge, [id]: (state.badge[id] || 0) + 1}};
        case MenuBadge.DECREASE:
            const id1 = action.page.route;
            return {...state, badge: {...state.badge, [id1]: (state.badge[id1] || 0) - 1}};
        case MenuBadge.RESET:
            const id2 = action.page && action.page.route;
            if (id2) return {...state, badge: {...state.badge, [id2]: 0}};
            else return {...state, badge: {}};
        default:
            return state;
    }
};
topMenuReducer.skipStore = true;

const mapStateToProps = ({topMenuReducer}) => ({
    badge: topMenuReducer.badge,
    // page: topMenuReducer.page,
});

export default connect(mapStateToProps)(withStyles(styles)(TopMenu));
