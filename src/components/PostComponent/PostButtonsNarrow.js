import React from "react";
import Grid from "@material-ui/core/Grid";
import ButtonLike from "./ButtonLike";
import ButtonDislike from "./ButtonDislike";
import ButtonReplies from "./ButtonReplies";
import ButtonShare from "./ButtonShare";
import ButtonDelete from "./ButtonDelete";

export default ({allowedExtras, postData, userData, classes = {}, showRepliesCounter = true, mentions, onChange, onDelete, isReply = false, type, UploadProps}) => {

    // return React.useMemo(() => {
    return <>
        <Grid className={classes.cardActions}>
            {allowedExtras.indexOf("like") >= 0 && <ButtonLike classes={classes} postData={postData}/>}
            {allowedExtras.indexOf("dislike") >= 0 && <ButtonDislike classes={classes} postData={postData}/>}
            {showRepliesCounter && <ButtonReplies classes={classes} postData={postData}/>}
            {!isReply && <ButtonShare postData={postData}/>}
            <ButtonDelete postData={postData} classes={classes} onChange={onChange} onDelete={onDelete} type={type}/>
        </Grid>
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
