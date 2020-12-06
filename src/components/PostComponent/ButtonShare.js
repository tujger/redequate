import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ShareIcon from "@material-ui/icons/Share";
import Grid from "@material-ui/core/Grid";
import {usePages} from "../../controllers/General";
import {copyToClipboard} from "../ShareComponent";
import MenuItem from "@material-ui/core/MenuItem";
import {notifySnackbar} from "../../controllers";
import ProgressView from "../ProgressView";
import {useDispatch} from "react-redux";

export default React.forwardRef(({postData, onMenuItemClick, ...props}, ref) => {
    const pages = usePages();
    const dispatch = useDispatch();

    const handleMenuItemClick = evt => {
        copyPathToClipboard();
        onMenuItemClick(evt);
    }

    const handleButtonClick = evt => {
        evt.stopPropagation();
        copyPathToClipboard();
    }

    const copyPathToClipboard = () => {
        dispatch(ProgressView.SHOW);
        postData.fetchPath()
            .then(path => copyToClipboard(window.location.origin + pages.post.route + path))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    if (onMenuItemClick) return <MenuItem ref={ref} onClick={handleMenuItemClick} id={"share"}>Share</MenuItem>

    return <Grid item>
        <IconButton
            aria-label={"Share"}
            children={<ShareIcon/>}
            component={"div"}
            onClick={handleButtonClick}
            size={"small"}
            title={"Share"}
        />
    </Grid>
})
