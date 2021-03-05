import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ShareIcon from "@material-ui/icons/Share";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import {useDispatch} from "react-redux";
import {useTranslation} from "react-i18next";
import {usePages} from "../../controllers/General";
import {share} from "../ShareComponent";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";

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
