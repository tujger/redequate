import React from "react";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from "@material-ui/icons/Edit";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import {useFirebase, useWindowData} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import ConfirmComponent from "../ConfirmComponent";
import MenuItem from "@material-ui/core/MenuItem";
import NewPostComponent from "../NewPostComponent/NewPostComponent";
import {mentionUsers, mentionTags} from "../../controllers/mentionTypes";
import {useTranslation} from "react-i18next";

export default ({postData, classes, mentions, onMenuItemClick, onComplete, type}) => {
    const [state, setState] = React.useState({});
    const {editPost} = state;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const windowData = useWindowData();
    const {t} = useTranslation();

    const handleMenuItemClick = evt => {
        onMenuItemClick(evt);
    }

    let element;
    if (onMenuItemClick) {
        element = <MenuItem
            children={"Edit"}
            id={"edit"}
            onClick={handleMenuItemClick}
        />
    } else {
        element = <Grid item>
            <IconButton
                aria-label={"Edit"}
                children={<EditIcon/>}
                component={"div"}
                size={"small"}
                title={"Edit"}
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
