import React from "react";
import {Menu} from "@mui/material";
import {IconButton} from "@mui/material";
import MenuIcon from "@mui/icons-material/MoreVert";
import {Fade} from "@mui/material";
import ActionShare from "./ActionShare";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import ActionDelete from "./ActionDelete";
import ActionEdit from "./ActionEdit";
import styles from "./styles/PostComponent.module.css";

export default (props) => {
    const {onChange, onDelete, postData} = props;
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
        <IconButton className={styles.menuButton} onClick={handleMenuClick}>
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
