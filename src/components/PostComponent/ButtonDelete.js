import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import {useFirebase} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import ConfirmComponent from "../ConfirmComponent";

export default ({postData, classes, onChange, onDelete, type}) => {
    const [state, setState] = React.useState({});
    const {
        deletePost,
    } = state;
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const currentUserData = useCurrentUserData();

    const handleClickDelete = evt => {
        evt && evt.stopPropagation();
        setState(state => ({...state, deletePost: true}));
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

    const isDeleteAllowed = currentUserData && !currentUserData.disabled && (postData.uid === currentUserData.id || matchRole([Role.ADMIN], currentUserData))

    return <>
        <Grid item>
            <IconButton
                aria-label={"Delete"}
                children={<ClearIcon/>}
                className={isDeleteAllowed ? null : classes.hidden}
                component={"div"}
                onClick={isDeleteAllowed ? handleClickDelete : null}
                size={"small"}
                title={"Delete"}
            />
        </Grid>
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
