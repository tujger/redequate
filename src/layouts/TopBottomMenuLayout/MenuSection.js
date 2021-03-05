import React from "react";
import MenuItem from "@material-ui/core/MenuItem";
import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import withStyles from "@material-ui/styles/withStyles";
import {Link, useHistory} from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Popper from "@material-ui/core/Popper";
import MenuList from "@material-ui/core/MenuList";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";

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
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    menusection: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.getContrastText(theme.palette.background.default),
        boxShadow: theme.shadows[2],
        zIndex: 2,
    },
    menuitem: {
        fontSize: "inherit",
        justifyContent: "space-between",
        width: "100%",
    },
});

const MenuSection = withStyles(styles)(props => {
    const {badge, items, classes, className, endIcon} = props;
    const [first, ...menu] = items;
    const [state, setState] = React.useState({anchor: null});
    const {anchor} = state;
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    // const buttonRef = React.useRef();

    if (!matchRole(first.roles, currentUserData)) return null;

    const checkForBadge = () => {
        return menu.filter(item => !!badge[item.route]).length > 0;
    }
    const hasBadge = checkForBadge();
    const itemsAllowed = items.filter(item => !item.disabled && item.route !== first.route && matchRole(item.roles, currentUserData));

    const handleMouseLeave = event => {
        // console.log(event.target, buttonRef.current, anchor)
        if (event.relatedTarget === anchor) return;
        setState({...state, anchor: null})
    }

    return <Button
        className={className}
        endIcon={endIcon}
        onClickCapture={ev => {
            if (itemsAllowed.length) {
                setState({...state, anchor: ev.currentTarget})
            }
        }}
        onClick={event => {
            event.stopPropagation();
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
                        if (item instanceof Array) {
                            return <MenuSection
                                key={index}
                                badge={{}}
                                className={["MuiButtonBase-root MuiListItem-root MuiMenuItem-root MuiButtonBase-root MuiButton-root MuiButton-text MuiMenuItem-gutters MuiListItem-gutters MuiListItem-button", classes.label, classes.menuitem].join(" ")}
                                items={item}
                                endIcon={<ArrowRightIcon/>}
                            />
                        }
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

export default MenuSection;
