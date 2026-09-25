import React from "react";
import MenuItem from "@material-ui/core/MenuItem";
import ShareIcon from "@material-ui/icons/Share";
import {useDispatch} from "react-redux";
import {useTranslation} from "react-i18next";
import {usePages} from "../../controllers/General";
import {share} from "../ShareComponent";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";

export default React.forwardRef(({classes = {}, isReply, onMenuItemClick, postData}, ref) => {
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

    return <div className={classes.action}>
        <div className={classes.iconButton}
            aria-label={t("Common.Share")}
            children={<ShareIcon/>}

            onClick={handleButtonClick}

            title={t("Common.Share")}
        />
    </div>
})
