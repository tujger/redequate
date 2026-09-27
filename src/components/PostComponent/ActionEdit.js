import EditIcon from "@material-ui/icons/Edit";
import React from "react";
import {useTranslation} from "react-i18next";
import {useMetaInfo, useWindowData} from "../../controllers/General";
import NewPostComponent from "../NewPostComponent/NewPostComponent";
import SelectItem from "../../controls/Select/SelectItem";
import actionStyles from "./styles/PostActions.module.css";

export default ({postData, mentions, onMenuItemClick, onComplete, ...selectProps}) => {
    const metaInfo = useMetaInfo();
    const windowData = useWindowData();
    const {t} = useTranslation();
    const {settings = {}} = metaInfo || {};
    const {postsAllowEdit} = settings;

    const handleMenuItemClick = evt => {
        onMenuItemClick(evt);
    }

    const handleSelectItemClick = evt => {
        handleMenuItemClick(evt);
        selectProps.onClick && selectProps.onClick(evt);
    }

    if (!postsAllowEdit) return null;

    const newPostProps = {
        context: postData.id,
        mentions,
        onComplete,
        editPostData: postData,
        title: t("Post.Edit post"),
        UploadProps: {camera: !windowData.isNarrow(), multi: true},
    };

    if (onMenuItemClick) return <SelectItem
        children={<NewPostComponent
            {...newPostProps}
            buttonComponent={<div onClick={handleMenuItemClick}>{t("Common.Edit")}</div>}
        />}
        {...selectProps}
        id={"edit"}
        onClick={handleSelectItemClick}
        value={"edit"}
    />;

    return <NewPostComponent
        {...newPostProps}
        buttonComponent={<div className={actionStyles.action}>
            <div className={actionStyles.iconButton}
                 aria-label={t("Common.Edit")}
                 children={<EditIcon/>}
                 title={t("Common.Edit")}
            />
        </div>}
    />;
}
