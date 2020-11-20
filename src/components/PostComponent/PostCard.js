import React from "react";
import {useHistory} from "react-router-dom";
import Hidden from "@material-ui/core/Hidden";
import {cacheDatas, usePages} from "../../controllers/General";
import PostCardLayoutNarrow from "./PostCardLayoutNarrow";
import PostCardLayoutWide from "./PostCardLayoutWide";

export default (
    {
        allowedExtras = ["like"],
        classes = {},
        className,
        collapsible = true,
        disableClick = false,
        disableButtons,
        isReply = false,
        level,
        mentions,
        onChange = postData => console.log("onChange", postData),
        onDelete = postData => console.log("onDelete", postData),
        postData,
        showRepliesCounter = true,
        type = "posts",
        UploadProps,
        userData,
    }) => {
    const history = useHistory();
    const pages = usePages();

    const handleChange = () => {
        cacheDatas.remove(postData.id);
        onChange(postData);
    }

    const handleDelete = () => {
        cacheDatas.remove(postData.id);
        onDelete(postData);
    }

    const handleClickPost = () => {
        history.push(pages.post.route + postData.id)
    }

    const componentProps = {
        allowedExtras,
        classes,
        className,
        collapsible,
        disableClick,
        isReply,
        level,
        handleChange,
        handleClickPost,
        handleDelete,
        mentions,
        postData,
        showRepliesCounter,
        type,
        userData,
        UploadProps,
    }

    return <>
        <Hidden mdUp>
            <PostCardLayoutNarrow {...componentProps}/>
        </Hidden>
        <Hidden smDown>
            <PostCardLayoutWide {...componentProps}/>
        </Hidden>
    </>
}
