import React from "react";
import {IconButton} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import {Grid} from "@mui/material";
import {MenuItem} from "@mui/material";
import {useDispatch} from "react-redux";
import {useTranslation} from "react-i18next";
import {usePages} from "../../controllers/General";
import {share} from "../ShareComponent.js";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView.js";

export default React.forwardRef(({isReply, onMenuItemClick, postData}, ref) => {
    const pages = usePages();
    const dispatch = useDispatch();
    const {t} = useTranslation();

    const handleMenuItemClick = evt => {
        sharePath();
        onMenuItemClick(evt);
    }

    const handleButtonClick = evt => {
        evt.stopPropagation();
        sharePath();
    }

    const sharePath = () => {
        dispatch(ProgressView.SHOW);
        postData.fetchPath()
            .then(path => share({
                shortify: isReply,
                url: window.location.origin + pages.post.route + path
            }))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    if (onMenuItemClick) return <MenuItem
        children={t("Common.Share")}
        ref={ref}
        onClick={handleMenuItemClick}
        id={"share"}
    />

    return <Grid item>
        <IconButton
            aria-label={t("Common.Share")}
            children={<ShareIcon/>}
            component={"div"}
            onClick={handleButtonClick}
            size={"small"}
            title={t("Common.Share")}
        />
    </Grid>
})
