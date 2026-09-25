import React from "react";
import MenuItem from "@material-ui/core/MenuItem";
import EditIcon from "@material-ui/icons/Edit";
import {useTranslation} from "react-i18next";
import {useMetaInfo, useWindowData} from "../../controllers/General";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

export default ({classes = {}, postData, mentions, onMenuItemClick, onComplete}) => {
    const metaInfo = useMetaInfo();
    const windowData = useWindowData();
    const {t} = useTranslation();
    const {settings = {}} = metaInfo || {};
    const {postsAllowEdit} = settings;

    const handleMenuItemClick = evt => {
        onMenuItemClick(evt);
    }

    if (!postsAllowEdit) return null;

    let element;
    if (onMenuItemClick) {
        element = <MenuItem
            children={t("Common.Edit")}
            id={"edit"}
            onClick={handleMenuItemClick}
        />
    } else {
        element = <div className={classes.action}>
            <div className={classes.iconButton}
                aria-label={t("Common.Edit")}
                children={<EditIcon/>}


                title={t("Common.Edit")}
            />
        </div>
    }

    return <>
        <NewPostComponent
            buttonComponent={element}
            context={postData.id}
            mentions={mentions}
            onComplete={onComplete}
            editPostData={postData}
            title={t("Post.Edit post")}
            UploadProps={{camera: !windowData.isNarrow(), multi: true}}
        />
    </>
}
