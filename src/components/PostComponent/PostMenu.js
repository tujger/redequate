import React from "react";
import Menu from "@material-ui/core/Menu";
import IconButton from "@material-ui/core/IconButton";
import Fade from "@material-ui/core/Fade";
import ButtonShare from "./ButtonShare";
import {matchRole, Role, useCurrentUserData} from "../../controllers";
import ButtonDelete from "./ButtonDelete";
import MenuIcon from "@material-ui/icons/MoreVert";

export default (props) => {
    const {classes, postData} = props;
    const currentUserData = useCurrentUserData();
    const [state, setState] = React.useState({});
    const {anchor} = state;

    const isDeleteAllowed = currentUserData && !currentUserData.disabled
        && (postData.uid === currentUserData.id || matchRole([Role.ADMIN], currentUserData))

    const handleMenuClick = event => {
        event.stopPropagation();
        setState(state => ({...state, anchor: event.currentTarget}));
    };

    const handleMenuClose = (event) => {
        event.stopPropagation();
        setState(state => ({...state, anchor: null}));
    };

    const items = [];
    items.push(<ButtonShare {...props} id={"share"} key={"share"} onMenuItemClick={handleMenuClose}/>);
    if (isDeleteAllowed) items.push(<ButtonDelete {...props} id={"delete"} key={"delete"} onMenuItemClick={handleMenuClose}/>);

    if (!items.length) return null;
    return <>
        <IconButton className={classes.cardMenuButton} onClick={handleMenuClick}>
            <MenuIcon/>
        </IconButton>
        {anchor && <Menu
            anchorEl={anchor}
            keepMounted
            onClose={handleMenuClose}
            open={Boolean(anchor)}
            TransitionComponent={Fade}
        >
            {items}
        </Menu>}
    </>
}
