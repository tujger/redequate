import React from "react";
import {Link} from "react-router-dom";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import PostBody from "./PostBody";
import {usePages, useWindowData} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import ReplyButtonsNarrow from "./ReplyButtonsNarrow";

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
    const pages = usePages();
    const windowData = useWindowData();

    // return React.useMemo(() => {
    return <>
        <Card
            className={[classes.card, flat ? classes.cardFlat : cloud ? classes.cardCloud : transparent ? classes.cardTransparent : "", className].join(" ")}>
            <CardHeader
                classes={{content: classes.cardContent, subheader: classes.cardSubheader}}
                className={[classes.cardHeader, classes.cardHeaderWithLabel, classes.post, classes.reply].join(" ")}
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
                title={<Grid container>
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
                    {windowData.isNarrow() && <Grid item xs/>}
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
                            // inlineCarousel={!disableClick}
                            mosaic
                        />
                    </Grid>}
                    {!disableButtons && <ReplyButtonsNarrow
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
        </Card>
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
