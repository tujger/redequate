import React from "react";
import {useHistory} from "react-router-dom";
import DislikeEmptyIcon from "@material-ui/icons/ThumbDownOutlined";
import DislikeFilledIcon from "@material-ui/icons/ThumbDown";
import {delay, usePages} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";
import CounterComponent from "../CounterComponent";

export default ({postData, classes}) => {
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {disabled} = state;

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

    return <div className={classes.action}>
        <div
            aria-label={"Dislike"}
            className={[classes.iconButton, classes.counter].join(" ")}

            onClick={disabled ? undefined : handleClickExtra("dislike")}

            title={"Dislike"}
        >
            <CounterComponent
                counter={postData.counter("dislike")}
                prefix={<>
                    {postData.extra("like") ? <DislikeFilledIcon/> : <DislikeEmptyIcon/>}
                    <div className={classes.box}/>
                </>}
                showZero
                zeroPrefix={<><DislikeEmptyIcon/><div className={classes.box}/></>}
            />
        </div>
    </div>
}
