import {Card, CardHeader, Grid} from "@mui/material";
import React from "react";
import {Link} from "react-router-dom";
import {toDateString} from "../../controllers/DateFormat";
import {useMetaInfo, usePages} from "../../controllers/General";
import {mentionTags} from "../../controllers/mentionTypes";
import AvatarView from "../AvatarView";
import MentionedTextComponent from "../MentionedTextComponent";
import PostBody from "./PostBody";
import PostButtons from "./PostButtons";
import PostCardWrapper from "./PostCardWrapper";
import PostMedia from "./PostMedia";
import PostMenu from "./PostMenu";
import RotatingReplies from "./RotatingReplies";
import styles from "./styles/PostComponent.module.css";

export default React.forwardRef((props, ref) => {
    const {
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
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {postsRotateReplies, postsAllowEdit} = settings;
    const ancillaryRef = React.useRef();

    return <Card
        className={[
            styles.container,
            // pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "",
            highlighted ? styles.highlight : "",
            className
        ].join(" ")}
        ref={ref}
    >
        <PostCardWrapper
            disableClick={disableClick}
            handleClickPost={handleClickPost}>
            <CardHeader
                classes={{content: styles.cardContent, subheader: styles.cardSubheader}}
                className={[styles.header, styles.headerWithLabel].join(" ")}
                avatar={<Link
                    className={styles.avatarSmall}
                    onClick={evt => evt.stopPropagation()}
                    to={pages.user.route + postData.uid}
                >
                    <AvatarView
                        className={styles.avatarSmall}
                        image={userData.image}
                        initials={userData.initials}
                        verified={true}
                    />
                </Link>}
                title={<Grid
                    container
                    alignItems={"baseline"}
                    className={[styles.inline, styles.title].join(" ")}>
                    <Grid
                        className={styles.userName}
                        item
                        // onClick={evt => evt.stopPropagation()}
                    >
                        <Link
                            to={pages.user.route + userData.id}
                            onClick={evt => evt.stopPropagation()}
                            className={[styles.label].join(" ")}
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
                        className={styles.date}
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
            className={styles.cardImage}
            container
        >
            <PostMedia
                images={postData.images}
                mosaic
            />
        </Grid>}
        {/*<Grid container alignItems={"flex-end"} justify={"flex-end"}>
            {postsAllowEdit && postData.edit && <Grid item xs className={styles.date}>
                Edited {toDateString(postData.editOf("last").timestamp)}
            </Grid>}
            {!disableButtons && <PostButtons {...props}/>}
        </Grid>*/}
        {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
        {level === undefined && postsRotateReplies === "inside" &&
            <RotatingReplies {...props} postId={postData.id}/>}
    </Card>
})
