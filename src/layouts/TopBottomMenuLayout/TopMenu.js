import React from "react";
import PropTypes from "prop-types";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import {currentRole, matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {Link, useHistory} from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Popper from "@material-ui/core/Popper";
import MenuList from "@material-ui/core/MenuList";
import AvatarView from "../../components/AvatarView";
import {usePages} from "../../controllers/General";
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
        zIndex: 2,
    },
    menusection: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.getContrastText(theme.palette.background.default),
        boxShadow: theme.shadows[2],
        zIndex: 2,
    },
    menuitem: {
        fontSize: "inherit"
    },
    profileitem: {
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
    const itemsAllowed = items.filter(item => !item.disabled && item.route !== first.route && matchRole(item.roles, currentUserData));

    const handleMouseLeave = event => {
        setState({...state, anchor: null})
    }

    return <Button
        className={"MuiTopMenu-section"}
        onClickCapture={ev => {
            if (itemsAllowed.length) {
                setState({...state, anchor: ev.currentTarget})
            }
        }}
        onClick={() => {
            history.push(first.route);
        }}
        onMouseEnter={ev => {
            if (itemsAllowed.length) {
                setState({...state, anchor: ev.currentTarget})
            }
        }}
        onMouseLeave={handleMouseLeave}
        variant={"text"}
    >
        {first.label}
        {hasBadge && <span className={classes.badge}/>}
        <Popper
            anchorEl={anchor}
            className={classes.menusection}
            // disablePortal
            onClose={() => setState({...state, anchor: null})}
            open={Boolean(anchor)}
            onMouseLeave={handleMouseLeave}
            placement={"bottom-end"}
            role={undefined}>
            <Paper>
                <MenuList>
                    {menu.map((item, index) => {
                        if (!matchRole(item.roles, currentUserData) || item.disabled) return null;
                        const child = <MenuItem
                            button
                            children={<>
                                {item.label}
                                {item.adornment && currentUserData && item.adornment(currentUserData)}
                            </>}
                            className={["MuiButtonBase-root MuiButton-root MuiButton-text", classes.label, classes.menuitem].join(" ")}
                            key={index}
                            /* eslint-disable-next-line react/jsx-handler-names */
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
            className={[classes.label, classes.profileitem].join(" ")}
        >
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
    badge: PropTypes.any,
    children: PropTypes.array,
    classes: PropTypes.any,
    className: PropTypes.string,
    items: PropTypes.array,
    pages: PropTypes.object,
};

const mapStateToProps = ({topMenuReducer}) => ({
    badge: topMenuReducer.badge,
});

export default connect(mapStateToProps)(withStyles(styles)(TopMenu));
