import DislikeFilledIcon from "@material-ui/icons/ThumbDown";
import DislikeEmptyIcon from "@material-ui/icons/ThumbDownOutlined";
import React from "react";
import {useHistory} from "react-router-dom";
import {delay, usePages} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import CounterComponent from "../CounterComponent";
import actionStyles from "./styles/PostActions.module.css";

export default ({postData}) => {
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

    return <div className={actionStyles.action}>
        <div
            aria-label={"Dislike"}
            className={[actionStyles.iconButton, actionStyles.counter].join(" ")}
            onClick={disabled ? undefined : handleClickExtra("dislike")}
            title={"Dislike"}
        >
            <CounterComponent
                counter={postData.counter("dislike")}
                prefix={<>
                    {postData.extra("like") ? <DislikeFilledIcon/> : <DislikeEmptyIcon/>}
                    <div className={actionStyles.box}/>
                </>}
                showZero
                zeroPrefix={<><DislikeEmptyIcon/>
                    <div className={actionStyles.box}/>
                </>}
            />
        </div>
    </div>
}
