import React from "react";
import Grid from "@material-ui/core/Grid";
import makeStyles from "@material-ui/core/styles/makeStyles";
import ButtonLike from "./ButtonLike";
import ButtonDislike from "./ButtonDislike";
import ButtonReplyNoIcon from "./ButtonReplyNoIcon";
import ButtonShare from "./ButtonShare";
import ButtonDelete from "./ButtonDelete";

const stylesCurrent = makeStyles(theme => ({
    cardActions: {
        "&$cardActionsSmall": {
            [theme.breakpoints.down("sm")]: {
                marginLeft: theme.spacing(-1),
            }
        },
    },
    cardActionsSmall: {
    },
}));


export default ({allowedExtras, postData, userData, classes = {}, showRepliesCounter = true, mentions, onChange, onDelete, isReply = false, type, UploadProps}) => {
    const classesCurrent = stylesCurrent();

    // return React.useMemo(() => {
    return <>
        <Grid className={[classes.cardActions, classesCurrent.cardActions, classesCurrent.cardActionsSmall].join(" ")}>
            {allowedExtras.indexOf("like") >= 0 && <ButtonLike classes={classes} postData={postData}/>}
            {allowedExtras.indexOf("dislike") >= 0 && <ButtonDislike classes={classes} postData={postData}/>}
            <ButtonReplyNoIcon mentions={mentions} onChange={onChange} postData={postData} UploadProps={UploadProps} userData={userData}/>
            <Grid item xs/>
            {!isReply && <ButtonShare postData={postData}/>}
            <ButtonDelete postData={postData} classes={classes} onChange={onChange} onDelete={onDelete} type={type}/>
        </Grid>
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
