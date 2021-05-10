import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import MenuItem from "@material-ui/core/MenuItem";
import {useTranslation} from "react-i18next";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import ConfirmComponent from "../ConfirmComponent";

export default ({postData, onMenuItemClick, onComplete, type}) => {
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

    let element;
    if (onMenuItemClick) {
        element = <MenuItem
            children={t("Common.Delete")}
            id={"delete"}
            onClick={handleMenuItemClick}
        />
    } else {
        element = <Grid item>
            <IconButton
                aria-label={t("Common.Delete")}
                children={<ClearIcon/>}
                component={"div"}
                onClick={handleClickDelete}
                size={"small"}
                title={t("Common.Delete")}
            />
        </Grid>
    }

    return <>
        {element}
        {deletePost && <ConfirmComponent
            children={t("Post.Your post and all replies will be deleted.")}
            confirmLabel={t("Common.Delete")}
            critical
            open={true}
            onCancel={handleCancelDeletion}
            onConfirm={handleConfirmDeletion}
            title={t("Post.Delete post?")}
        />}
    </>
}
