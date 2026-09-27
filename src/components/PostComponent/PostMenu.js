import MenuIcon from "@material-ui/icons/MoreVert";
import React from "react";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import Select from "../../controls/Select/Select";
import ActionDelete from "./ActionDelete";
import ActionEdit from "./ActionEdit";
import ActionShare from "./ActionShare";
import cardStyles from "./styles/PostComponent.module.css";

export default (props) => {
    const {onChange, onDelete, postData} = props;
    const currentUserData = useCurrentUserData();
    const [open, setOpen] = React.useState(false);

    const isDeleteAllowed = currentUserData && !currentUserData.disabled
        && (postData.uid === currentUserData.id || matchRole([Role.ADMIN], currentUserData));

    const handleMenuTrigger = event => {
        event.stopPropagation();
    };

    const handleMenuOpen = event => {
        event && event.stopPropagation();
        setOpen(true);
    };

    const handleMenuClose = event => {
        event && event.stopPropagation();
        setOpen(false);
    };

    const items = [];
    items.push(<ActionShare
        {...props} id={"share"}
        key={"share"}
        onMenuItemClick={handleMenuClose}
    />);
    if (isDeleteAllowed) {
        items.push(<ActionEdit
            {...props}
            id={"edit"}
            key={"edit"}
            onMenuItemClick={handleMenuClose}
            onComplete={onChange}
        />);
        items.push(<ActionDelete
            {...props}
            id={"delete"}
            key={"delete"}
            onMenuItemClick={handleMenuClose}
            onComplete={onDelete}
        />);
    }

    if (!items.length) return null;
    return <Select
        className={cardStyles.cardMenuButton}
        displayEmpty
        iconMenu
        IconComponent={() => null}
        onChange={handleMenuClose}
        onClick={handleMenuTrigger}
        onMouseDown={handleMenuTrigger}
        onOpen={handleMenuOpen}
        onClose={handleMenuClose}
        MenuProps={{
            keepMounted: true,
        }}
        open={open}
        renderValue={() => <MenuIcon/>}
        value={""}
    >
        {items}
    </Select>
}
