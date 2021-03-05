import React from "react";
import {useHistory} from "react-router-dom";
import IconButton from "@material-ui/core/IconButton";
import ChatEmptyIcon from "@material-ui/icons/ChatBubbleOutline";
import ChatFilledIcon from "@material-ui/icons/Chat";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
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

    return <Grid item>
        <IconButton
            className={classes.counter}
            component={"div"}
            onClick={event => {
                event.stopPropagation();
                dispatch({type: lazyListComponentReducer.REFRESH});
                history.push(pages.post.route + postData.id, {
                    onlyReplies: !!postData.counter("replied"),
                })
            }}
            size={"small"}
            title={t("Post.Replies")}
        >
            <CounterComponent
                counter={postData.counter("replied")}
                path={disableClick ? `${postData.id}/replied` : undefined}
                prefix={<><ChatFilledIcon/><Box m={0.5}/></>}
                showZero
                zeroPrefix={<><ChatEmptyIcon/><Box m={0.5}/></>}
            />
        </IconButton>
    </Grid>
}
