import MenuItem from "@material-ui/core/MenuItem";
import ShareIcon from "@material-ui/icons/Share";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {usePages} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import {share} from "../ShareComponent";
import actionStyles from "./styles/PostActions.module.css";

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
                shortify: isReply, url: window.location.origin + pages.post.route + path
            }))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    if (onMenuItemClick) {
        return <MenuItem
            children={t("Common.Share")}
            ref={ref}
            onClick={handleMenuItemClick}
            id={"share"}
            value={"share"}
        />
    }

    return <div className={actionStyles.action}>
        <div className={actionStyles.iconButton}
             aria-label={t("Common.Share")}
             children={<ShareIcon/>}
             onClick={handleButtonClick}
             title={t("Common.Share")}
        />
    </div>
})
