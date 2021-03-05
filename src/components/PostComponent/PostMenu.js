import React from "react";
import Menu from "@material-ui/core/Menu";
import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/MoreVert";
import Fade from "@material-ui/core/Fade";
import ActionShare from "./ActionShare";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import ActionDelete from "./ActionDelete";
import ActionEdit from "./ActionEdit";

export default (props) => {
    const {classes, onChange, onDelete, postData} = props;
    const currentUserData = useCurrentUserData();
    const [state, setState] = React.useState({});
    const {anchor} = state;

    const isDeleteAllowed = currentUserData && !currentUserData.disabled
        && (postData.uid === currentUserData.id || matchRole([Role.ADMIN], currentUserData));

    const handleMenuClick = event => {
        event.stopPropagation();
        setState(state => ({...state, anchor: event.currentTarget}));
    };

    const handleMenuClose = (event) => {
        event.stopPropagation();
        setState(state => ({...state, anchor: null}));
    };

    const items = [];
    items.push(<ActionShare {...props} id={"share"} key={"share"} onMenuItemClick={handleMenuClose}/>);
    if (isDeleteAllowed) {
        items.push(<ActionEdit {...props} id={"edit"} key={"edit"} onMenuItemClick={handleMenuClose} onComplete={onChange}/>);
        items.push(<ActionDelete {...props} id={"delete"} key={"delete"} onMenuItemClick={handleMenuClose} onComplete={onDelete}/>);
    }

    if (!items.length) return null;
    return <>
        <IconButton className={classes.cardMenuButton} onClick={handleMenuClick}>
            <MenuIcon/>
        </IconButton>
        <Menu
            anchorEl={anchor}
            keepMounted
            onClose={handleMenuClose}
            open={Boolean(anchor)}
            TransitionComponent={Fade}
        >
            {items}
        </Menu>
    </>
}
