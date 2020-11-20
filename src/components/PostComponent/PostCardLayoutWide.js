import React from "react";
import {Link} from "react-router-dom";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import RepliesTree from "./RepliesTree";
import PostButtons from "./PostButtons";
import PostBody from "./PostBody";
import {usePages} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import PostCardWrapper from "./PostCardWrapper";

export default (
    {
        allowedExtras = ["like"],
        classes = {},
        className,
        collapsible = true,
        disableClick = false,
        disableButtons,
        handleChange,
        handleClickPost,
        handleDelete,
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
    const pages = usePages();

    // return React.useMemo(() => {
    return <>
        <Card className={[classes.root, classes.card, className].join(" ")}>
            <PostCardWrapper disableClick={disableClick} handleClickPost={handleClickPost}>
                <CardHeader
                    classes={{content: classes.cardContent, subheader: classes.cardSubheader}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={<Link
                        className={classes.avatar}
                        to={!disableClick ? "#" : pages.user.route + postData.uid}
                    >
                        <AvatarView
                            className={classes.avatar}
                            image={userData.image}
                            initials={userData.initials}
                            verified={true}
                        />
                    </Link>}
                    title={<Grid container>
                        <Grid item className={classes.userName}>
                            <Link
                                to={!disableClick ? "#" : pages.user.route + userData.id}
                                className={[classes.label].join(" ")}
                            >{userData.name}</Link>
                        </Grid>
                        <Grid item className={classes.date} title={new Date(postData.created).toLocaleString()}>
                            {toDateString(postData.created)}
                        </Grid>
                    </Grid>}
                    subheader={<>
                        <PostBody
                            classes={classes}
                            collapsible={collapsible}
                            disableClick={!disableClick}
                            mentions={mentions}
                            postData={postData}
                        />
                        {postData.images && <Grid
                            className={classes.cardImage}
                            container
                        >
                            <PostMedia
                                images={postData.images}
                                inlineCarousel={false}
                                clickable={disableClick}
                            />
                        </Grid>}
                        {!disableButtons && <PostButtons
                            allowedExtras={allowedExtras}
                            classes={classes}
                            isReply={isReply}
                            mentions={mentions}
                            onChange={handleChange}
                            onDelete={handleDelete}
                            postData={postData}
                            showRepliesCounter={showRepliesCounter}
                            type={type}
                            UploadProps={UploadProps}
                            userData={userData}
                        />}
                    </>}
                />
            </PostCardWrapper>
        </Card>
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
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
