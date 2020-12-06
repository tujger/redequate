import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import {useFirebase} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import ConfirmComponent from "../ConfirmComponent";
import MenuItem from "@material-ui/core/MenuItem";

export default ({postData, classes, onMenuItemClick, onDelete, type}) => {
    const [state, setState] = React.useState({});
    const {
        deletePost,
    } = state;
    const dispatch = useDispatch();
    const firebase = useFirebase();

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
        firebase.database().ref(type).child(postData.id).set(null)
            .then(() => {
                notifySnackbar({title: "Post successfully deleted."});
                setTimeout(() => {
                    onDelete && onDelete(postData);
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
            children={"Delete"}
            id={"delete"}
            onClick={handleMenuItemClick}
        />
    } else {
        element = <Grid item>
            <IconButton
                aria-label={"Delete"}
                children={<ClearIcon/>}
                component={"div"}
                onClick={handleClickDelete}
                size={"small"}
                title={"Delete"}
            />
        </Grid>
    }

    return <>
        {element}
        {deletePost && <ConfirmComponent
            children={"Your post and all replies will be deleted."}
            confirmLabel={"Delete"}
            critical
            open={true}
            onCancel={handleCancelDeletion}
            onConfirm={handleConfirmDeletion}
            title={"Delete post?"}
        />}
    </>
}
