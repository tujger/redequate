import React from "react";
import {useHistory} from "react-router-dom";
import IconButton from "@material-ui/core/IconButton";
import LikeEmptyIcon from "@material-ui/icons/ThumbUpOutlined";
import LikeFilledIcon from "@material-ui/icons/ThumbUp";
import Grid from "@material-ui/core/Grid";
import {delay, usePages} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";
import useTheme from "@material-ui/styles/useTheme";

export default ({postData, classes}) => {
    const [state, setState] = React.useState({});
    const {disabled} = state;
    const history = useHistory();
    const pages = usePages();
    const theme = useTheme();
    const currentUserData = useCurrentUserData();

    const handleClickExtra = extraType => evt => {
        evt && evt.stopPropagation();
        if (disabled) return;
        if (!currentUserData || !currentUserData.id) {
            history.push(pages.login.route);
            return;
        }
        if (!isPostingAllowed) {
            history.push(pages.profile.route);
            return;
        }
        setState(state => ({...state, disabled: true}))
        postData[postData.extra(extraType) ? "removeExtra" : "putExtra"]({type: extraType, uid: currentUserData.id})
            // .then(postData.fetchCounters)
            .then(postData => setState(state => ({...state, postData})))
            .then(() => delay(1000))
            .then(() => setState(state => ({...state, disabled: false})))
            .catch(notifySnackbar)
    }

    const isPostingAllowed = matchRole([Role.ADMIN, Role.USER], currentUserData);

    // return React.useMemo(() => {
    return <Grid item>
        <IconButton
            aria-label={"Like"}
            component={"div"}
            onClick={handleClickExtra("like")}
            size={"small"}
            style={postData.extra("like") ? {color: theme.palette.secondary.main} : undefined}
            title={"Like"}
        >
            {postData.extra("like") ? <LikeFilledIcon/> : <LikeEmptyIcon/>}
            <span className={classes.counter}>{postData.counter("like")}</span>
        </IconButton>
    </Grid>
}
