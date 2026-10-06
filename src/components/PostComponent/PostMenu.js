import React from "react";
import {useTranslation} from "react-i18next";
import {useMetaInfo} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import Select from "../../controls/Select/Select";
import SelectItem from "../../controls/Select/SelectItem";
import ActionDelete from "./ActionDelete";
import ActionEdit from "./ActionEdit";
import ActionShare from "./ActionShare";
import cardStyles from "./styles/PostComponent.module.css";

export default (props) => {
    const {onChange, onDelete, postData} = props;
    const currentUserData = useCurrentUserData();
    const metaInfo = useMetaInfo();
    const {t} = useTranslation();
    const [open, setOpen] = React.useState(false);
    const [editRequest, setEditRequest] = React.useState(0);
    const [deleteOpen, setDeleteOpen] = React.useState(false);

    const isDeleteAllowed = currentUserData && !currentUserData.disabled
        && (postData.uid === currentUserData.id || matchRole([Role.ADMIN], currentUserData));
    const canEdit = isDeleteAllowed && metaInfo?.settings?.postsAllowEdit;

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

    const handleMenuSelect = event => {
        handleMenuClose(event);
        if (event.target.value === "edit") setEditRequest(request => request + 1);
        if (event.target.value === "delete") setDeleteOpen(true);
    };

    const items = [];
    items.push(<ActionShare
        {...props}
        id={"share"}
        key={"share"}
        onMenuItemClick={handleMenuClose}
    />);
    if (isDeleteAllowed) {
        if (canEdit) {
            items.push(<SelectItem
                key={"edit"}
                value={"edit"}
            >{t("Common.Edit")}</SelectItem>);
        }
        items.push(<SelectItem
            key={"delete"}
            value={"delete"}
        >{t("Common.Delete")}</SelectItem>);
    }

    if (!items.length) return null;
    return <>
        <Select
            className={cardStyles.cardMenuButton}
            color={"secondary"}
            iconMenu
            onChange={handleMenuSelect}
            onClick={handleMenuTrigger}
            onMouseDown={handleMenuTrigger}
            onOpen={handleMenuOpen}
            onClose={handleMenuClose}
            open={open}
            value={""}
        >
            {items}
        </Select>
        {canEdit && <ActionEdit
            {...props}
            modalOnly
            onComplete={onChange}
            openRequest={editRequest}
        />}
        {isDeleteAllowed && <ActionDelete
            {...props}
            modalOnly
            onComplete={onDelete}
            onRequestClose={() => setDeleteOpen(false)}
            open={deleteOpen}
        />}
    </>;
}
