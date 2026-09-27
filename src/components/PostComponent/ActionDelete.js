import React from "react";
import actionStyles from "./styles/PostActions.module.css";
import ClearIcon from "@material-ui/icons/Clear";
import {useDispatch} from "react-redux";
import {useTranslation} from "react-i18next";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import ConfirmComponent from "../ConfirmComponent";
import SelectItem from "../../controls/Select/SelectItem";

export default ({postData, onMenuItemClick, onComplete, type, ...selectProps}) => {
    const [state, setState] = React.useState({});
    const {
        deletePost,
    } = state;
    const dispatch = useDispatch();
    const {t} = useTranslation();

    const handleClickDelete = evt => {
        evt && evt.stopPropagation();
        setState(state => ({...state, deletePost: true}));
    }

    const handleMenuItemClick = evt => {
        setState(state => ({...state, deletePost: true}));
        onMenuItemClick(evt);
    }

    const handleSelectItemClick = evt => {
        handleMenuItemClick(evt);
        selectProps.onClick && selectProps.onClick(evt);
    }

    const handleConfirmDeletion = () => {
        setState(state => ({...state, deletePost: false}));
        if (!postData.id) return;
        dispatch(ProgressView.SHOW);
        postData.delete()
            .then(() => {
                notifySnackbar({title: t("Post.Post successfully deleted.")});
                setTimeout(() => {
                    onComplete && onComplete(postData);
                }, 2000)
            })
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    const handleCancelDeletion = () => {
        setState(state => ({...state, deletePost: false}));
    }

    const confirm = deletePost && <ConfirmComponent
        children={t("Post.Your post and all replies will be deleted.")}
        confirmLabel={t("Common.Delete")}
        critical
        open={true}
        onCancel={handleCancelDeletion}
        onConfirm={handleConfirmDeletion}
        title={t("Post.Delete post?")}
    />;

    if (onMenuItemClick) return <SelectItem
        children={<>
            {t("Common.Delete")}
            {confirm}
        </>}
        {...selectProps}
        id={"delete"}
        onClick={handleSelectItemClick}
        value={"delete"}
    />;

    return <>
        <div className={actionStyles.action}>
            <div className={actionStyles.iconButton}
                 aria-label={t("Common.Delete")}
                 children={<ClearIcon/>}
                 onClick={handleClickDelete}
                 title={t("Common.Delete")}
            />
        </div>
        {confirm}
    </>
}
