import React from "react";
import {Link} from "react-router-dom";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import PostBody from "./PostBody";
import {useMetaInfo, usePages} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import PostCardWrapper from "./PostCardWrapper";
import MentionedTextComponent from "../MentionedTextComponent";
import {mentionTags} from "../../controllers/mentionTypes";
import PostButtons from "./PostButtons";
import makeStyles from "@material-ui/core/styles/makeStyles";
import PostMenu from "./PostMenu";
import RotatingReplies from "./RotatingReplies";

const stylesCurrent = makeStyles(theme => ({
    inline: {
        letterSpacing: theme.typography.body2.letterSpacing,
        display: "inline",
        "& > .MuiGrid-root": {
            display: "inline",
        }
    },
}));

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
    const classesCurrent = stylesCurrent();
    const pages = usePages();
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {postsRotateReplies, postsAllowEdit} = settings;
    const ancillaryRef = React.useRef();

    return <Card
        className={[
            classes.card,
            pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "",
            highlighted ? classes.cardHighlighted : "",
            className
        ].join(" ")}
        ref={ref}
    >
        <PostCardWrapper
            classes={classes}
            disableClick={disableClick}
            handleClickPost={handleClickPost}>
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
                title={<Grid
                    container
                    alignItems={"baseline"}
                    className={[classesCurrent.inline, classes.cardTitle].join(" ")}>
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
                    <PostMenu {...props}/>
                    {postData.targetTag && <Grid item xs>
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
                    <Grid
                        item
                        className={classes.date}
                        title={new Date(postData.created).toLocaleString()}>
                        {toDateString(postData.created)}
                    </Grid>
                </>}
            />
            <PostBody
                {...props}
                ref={ancillaryRef}
                disableClick={!disableClick}
            />
        </PostCardWrapper>
        {postData.images && <Grid
            className={classes.cardImage}
            container
        >
            <PostMedia
                images={postData.images}
                mosaic
            />
        </Grid>}
        {/*<Grid container alignItems={"flex-end"} justify={"flex-end"}>
            {postsAllowEdit && postData.edit && <Grid item xs className={classes.date}>
                Edited {toDateString(postData.editOf("last").timestamp)}
            </Grid>}
            {!disableButtons && <PostButtons {...props}/>}
        </Grid>*/}
        {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
        {level === undefined && postsRotateReplies === "inside" &&
        <RotatingReplies {...props} postId={postData.id}/>}
    </Card>
})
