import ChatFilledIcon from "@material-ui/icons/Chat";
import ChatEmptyIcon from "@material-ui/icons/ChatBubbleOutline";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import {usePages} from "../../controllers/General";
import Button from "../../controls/Button/Button";
import CounterComponent from "../CounterComponent";
import {lazyListComponentReducer} from "../LazyListComponent/lazyListComponentReducer";
import actionStyles from "./styles/PostActions.module.css";

export default ({postData, disableClick}) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const {t} = useTranslation();

    return <div className={actionStyles.action}>
        <Button
            aria-label={t("Post.Replies")}
            className={actionStyles.iconButton}
            color={"secondary"}
            icon={postData.counter("replied") ? <ChatFilledIcon/> : <ChatEmptyIcon/>}
            onClick={event => {
                event.stopPropagation();
                dispatch({type: lazyListComponentReducer.REFRESH});
                history.push(pages.post.route + postData.id, {
                    onlyReplies: !!postData.counter("replied"),
                })
            }}
            title={t("Post.Replies")}
            variant={"text"}
        >
            <div className={actionStyles.box}/>
        </Button>
        <CounterComponent
            counter={postData.counter("replied")}
            path={disableClick ? `${postData.id}/replied` : undefined}
            showZero
        />
    </div>
}
