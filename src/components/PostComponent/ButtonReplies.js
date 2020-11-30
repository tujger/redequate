import React from "react";
import {useHistory} from "react-router-dom";
import IconButton from "@material-ui/core/IconButton";
import ChatEmptyIcon from "@material-ui/icons/ChatBubbleOutline";
import ChatFilledIcon from "@material-ui/icons/Chat";
import Grid from "@material-ui/core/Grid";
import {usePages} from "../../controllers/General";

export default ({postData, classes}) => {
    const history = useHistory();
    const pages = usePages();

    return <Grid item>
        <IconButton
            component={"div"}
            onClick={event => {
                event.stopPropagation();
                history.push(pages.post.route + postData.id, {
                    onlyReplies: !!postData.counter("replied")
                })
            }}
            size={"small"}
        >
            {postData.counter("replied") ? <ChatFilledIcon/> : <ChatEmptyIcon/>}
            <span className={classes.counter}>{postData.counter("replied")}</span>
        </IconButton>
    </Grid>
}
