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
import PostButtons from "./PostButtons";
import PostMenu from "./PostMenu";

export default React.forwardRef((props, ref) => {
    const {
        classes = {},
        className,
        disableClick,
        disableButtons,
        handleClickPost,
        level,
        pattern,
        postData,
        userData,
        highlighted,
    } = props;
    const pages = usePages();

    // return React.useMemo(() => {
    return <Card
        className={[
            classes.card,
            pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "",
            highlighted ? classes.cardHighlighted : "",
            className
        ].join(" ")}
        ref={ref}
    >
        <PostCardWrapper classes={classes} disableClick={disableClick} handleClickPost={handleClickPost}>
            <CardHeader
                classes={{content: classes.cardContent, subheader: classes.cardSubheader}}
                className={[
                    classes.cardHeader,
                    classes.post,
                ].join(" ")}
                avatar={<Link
                    className={classes.avatar}
                    onClick={evt => evt.stopPropagation()}
                    to={pages.user.route + postData.uid}
                >
                    <AvatarView
                        className={level > 1 ? classes.avatarSmallest : classes.avatar}
                        image={userData.image}
                        initials={userData.initials}
                        verified={true}
                    />
                </Link>}
                title={<Grid container>
                    <Grid
                        className={classes.userName}
                        item
                    >
                        <Link
                            className={[classes.label].join(" ")}
                            onClick={evt => evt.stopPropagation()}
                            to={pages.user.route + userData.id}
                        >{userData.name}</Link>
                    </Grid>
                    <Grid item className={classes.date} title={new Date(postData.created).toLocaleString()}>
                        {toDateString(postData.created)}
                    </Grid>
                    {postData.targetTag && <Grid item>
                        - posted to <MentionedTextComponent
                        mentions={[{
                            ...mentionTags,
                            displayTransform: (id, display) => display,
                            style: {fontWeight: "bold"}
                        }]}
                        tokens={[postData.targetTag]}
                    /></Grid>}
                    <PostMenu {...props}/>
                </Grid>}
                subheader={<>
                    <PostBody
                        {...props}
                        disableClick={!disableClick}
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
                    {!disableButtons && <PostButtons {...props}/>}
                </>}
            />
        </PostCardWrapper>
    </Card>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
});
