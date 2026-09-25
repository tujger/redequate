import React from "react";
import {useHistory} from "react-router-dom";
import ChatEmptyIcon from "@material-ui/icons/ChatBubbleOutline";
import ChatFilledIcon from "@material-ui/icons/Chat";
import {useDispatch} from "react-redux";
import {useTranslation} from "react-i18next";
import {usePages} from "../../controllers/General";
import CounterComponent from "../CounterComponent";
import {lazyListComponentReducer} from "../LazyListComponent/lazyListComponentReducer";

export default ({postData, classes, disableClick}) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const {t} = useTranslation();

    return <div className={classes.action}>
        <div
            className={[classes.iconButton, classes.counter].join(" ")}

            onClick={event => {
                event.stopPropagation();
                dispatch({type: lazyListComponentReducer.REFRESH});
                history.push(pages.post.route + postData.id, {
                    onlyReplies: !!postData.counter("replied"),
                })
            }}

            title={t("Post.Replies")}
        >
            <CounterComponent
                counter={postData.counter("replied")}
                path={disableClick ? `${postData.id}/replied` : undefined}
                prefix={<><ChatFilledIcon/><div className={classes.box}/></>}
                showZero
                zeroPrefix={<><ChatEmptyIcon/><div className={classes.box}/></>}
            />
        </div>
    </div>
}
