import React from "react";
import {IconButton} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import {Grid} from "@mui/material";
import {MenuItem} from "@mui/material";
import {useTranslation} from "react-i18next";
import {useMetaInfo, useWindowData} from "../../controllers/General";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

export default ({postData, mentions, onMenuItemClick, onComplete}) => {
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
        element = <Grid item>
            <IconButton
                aria-label={t("Common.Edit")}
                children={<EditIcon/>}
                component={"div"}
                size={"small"}
                title={t("Common.Edit")}
            />
        </Grid>
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
