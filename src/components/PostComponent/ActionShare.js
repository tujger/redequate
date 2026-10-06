import ShareIcon from "@material-ui/icons/Share";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {usePages} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import {share} from "../ShareComponent";
import SelectItem from "../../controls/Select/SelectItem";
import actionStyles from "./styles/PostActions.module.css";

export default React.forwardRef(({isReply, onMenuItemClick, postData, ...selectProps}, ref) => {
    const pages = usePages();
    const dispatch = useDispatch();
    const {t} = useTranslation();

    const handleMenuItemClick = evt => {
        sharePath();
        onMenuItemClick(evt);
    }

    const handleSelectItemClick = evt => {
        handleMenuItemClick(evt);
        selectProps.onClick && selectProps.onClick(evt);
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
        return <SelectItem
            children={t("Common.Share")}
            {...selectProps}
            ref={ref}
            onClick={handleSelectItemClick}
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
