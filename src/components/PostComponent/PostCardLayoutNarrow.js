import React from "react";
import {Link} from "react-router-dom";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import PostBody from "./PostBody";
import {usePages} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import PostCardWrapper from "./PostCardWrapper";
import MentionedTextComponent from "../MentionedTextComponent";
import {mentionTags} from "../..";
import PostButtonsNarrow from "./PostButtonsNarrow";
import makeStyles from "@material-ui/core/styles/makeStyles";

const stylesCurrent = makeStyles(theme => ({
    inline: {
        display: "inline",
        "& > .MuiGrid-root": {
            display: "inline",
        }
    },
}));

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
        transparent,
        type = "posts",
        UploadProps,
        userData,
    }) => {
    const classesCurrent = stylesCurrent();
    const pages = usePages();

    // return React.useMemo(() => {
    return <>
        <Card className={[classes.card, flat ? classes.cardFlat : cloud ? classes.cardCloud : transparent ? classes.cardTransparent : "", className].join(" ")}>
            <PostCardWrapper classes={classes} disableClick={disableClick} handleClickPost={handleClickPost}>
                <CardHeader
                    classes={{content: classes.cardContent, subheader: classes.cardSubheader}}
                    className={[classes.cardHeader, classes.cardHeaderWithLabel, classes.post].join(" ")}
                    avatar={<Link
                        className={classes.avatarSmall}
                        onClick={evt => evt.stopPropagation()}
                        to={pages.user.route + postData.uid}
                    >
                        <AvatarView
                            className={classes.avatarSmall}
                            image={userData.image}
                            initials={userData.initials}
                            verified={true}
                        />
                    </Link>}
                    title={<Grid container alignItems={"baseline"} className={classesCurrent.inline}>
                        <Grid
                            className={classes.userName}
                            item
                            // onClick={evt => evt.stopPropagation()}
                        >
                            <Link
                                to={pages.user.route + userData.id}
                                onClick={evt => evt.stopPropagation()}
                                className={[classes.label].join(" ")}
                            >{userData.name}</Link>
                        </Grid>
                        {postData.targetTag && <Grid item xs >
                            posted to <MentionedTextComponent
                            mentions={[{
                                ...mentionTags,
                                displayTransform: (id, display) => display,
                                style: {fontWeight: "bold"}
                            }]}
                            tokens={[postData.targetTag]}
                        /></Grid>}
                    </Grid>}
                    subheader={<>
                        <Grid item className={classes.date} title={new Date(postData.created).toLocaleString()}>
                            {toDateString(postData.created)}
                        </Grid>
                    </>}
                />
                <PostBody
                    classes={classes}
                    collapsible={collapsible}
                    disableClick={!disableClick}
                    mentions={mentions}
                    postData={postData}
                />
            </PostCardWrapper>
            {postData.images && <Grid
                className={classes.cardImage}
                container
            >
                <PostMedia
                    images={postData.images}
                    // inlineCarousel={!disableClick}
                    mosaic
                />
            </Grid>}
            {!disableButtons && <PostButtonsNarrow
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
        </Card>
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
