import React from "react";
import {useHistory} from "react-router-dom";
import IconButton from "@material-ui/core/IconButton";
import DislikeEmptyIcon from "@material-ui/icons/ThumbDownOutlined";
import DislikeFilledIcon from "@material-ui/icons/ThumbDown";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import {delay, usePages} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";
import CounterComponent from "../CounterComponent";

export default ({postData, classes}) => {
    const [state, setState] = React.useState({});
    const {
        disabled
    } = state;
    const history = useHistory();
    const pages = usePages();
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

    return <Grid item>
        <IconButton
            aria-label={"Dislike"}
            className={classes.counter}
            component={"div"}
            onClick={handleClickExtra("dislike")}
            size={"small"}
            title={"Dislike"}
        >
            <CounterComponent
                counter={postData.counter("dislike")}
                prefix={<>
                    {postData.extra("like") ? <DislikeFilledIcon/> : <DislikeEmptyIcon/>}
                    <Box m={0.5}/>
                </>}
                showZero
                zeroPrefix={<><DislikeEmptyIcon/><Box m={0.5}/></>}
            />
        </IconButton>
    </Grid>
}
