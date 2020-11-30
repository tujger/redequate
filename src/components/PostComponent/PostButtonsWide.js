import React from "react";
import Grid from "@material-ui/core/Grid";
import ButtonDelete from "./ButtonDelete";
import ButtonReply from "./ButtonReply";
import ButtonLike from "./ButtonLike";
import ButtonDislike from "./ButtonDislike";
import ButtonReplies from "./ButtonReplies";
import ButtonShare from "./ButtonShare";

export default ({allowedExtras, postData, userData, classes = {}, showRepliesCounter = true, mentions, onChange, onDelete, isReply = false, type, UploadProps}) => {

    return <Grid className={classes.cardActions}>
        {allowedExtras.indexOf("like") >= 0 && <ButtonLike classes={classes} postData={postData}/>}
        {allowedExtras.indexOf("dislike") >= 0 && <ButtonDislike classes={classes} postData={postData}/>}
        {showRepliesCounter && <ButtonReplies classes={classes} postData={postData}/>}
        <ButtonReply mentions={mentions} onChange={onChange} postData={postData} UploadProps={UploadProps} userData={userData}/>
        {!isReply && <ButtonShare postData={postData}/>}
        <ButtonDelete postData={postData} classes={classes} onChange={onChange} onDelete={onDelete} type={type}/>
    </Grid>
}
