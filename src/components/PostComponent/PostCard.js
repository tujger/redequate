import React from "react";
import {useHistory} from "react-router-dom";
import Hidden from "@material-ui/core/Hidden";
import {cacheDatas, usePages} from "../../controllers/General";
import PostCardLayoutNarrow from "./PostCardLayoutNarrow";
import PostCardLayoutWide from "./PostCardLayoutWide";
import RepliesTree from "./RepliesTree";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import AvatarView from "../AvatarView";
import ReplyCardLayoutNarrow from "./ReplyCardLayoutNarrow";

export default (
    {
        allowedExtras = ["like"],
        classes = {},
        className,
        cloud,
        collapsible = true,
        disableClick = false,
        disableButtons,
        flat,
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

    const onlyReplies = level === 0 && history && history.location && history.location.state && history.location.state.onlyReplies;

    const componentProps = {
        allowedExtras,
        classes,
        className,
        cloud,
        collapsible,
        disableClick,
        flat,
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
        {/*{onlyReplies && <ItemPlaceholderComponent
            avatar={<AvatarView
                className={classes.avatarSmall}
                image={userData.image}
                initials={userData.initials}
                verified
            />}
            label={<span>Show original post</span>}
            onClick={() => history.push(pages.post.route + postData.id)}
        />}*/}
        {!onlyReplies && <>
            <Hidden mdUp>
                {level > 0
                    ? <ReplyCardLayoutNarrow {...componentProps} onlyReplies={onlyReplies}/>
                    : <PostCardLayoutNarrow {...componentProps} onlyReplies={onlyReplies}/>}
            </Hidden>
            <Hidden smDown>
                <PostCardLayoutWide {...componentProps} onlyReplies={onlyReplies}/>
            </Hidden>
        </>}
        {level !== undefined && <RepliesTree
            allowedExtras={allowedExtras}
            level={level}
            postId={postData.id}
            classes={classes}
            onChange={handleChange}
            onDelete={handleDelete}
            type={type}
            UploadProps={UploadProps}
        />}
    </>
}
