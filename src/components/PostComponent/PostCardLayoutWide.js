import React from "react";
import {Link} from "react-router-dom";
import {CardHeader} from "@mui/material";
import {Card} from "@mui/material";
import {Grid} from "@mui/material";
import PostBody from "./PostBody";
import {useMetaInfo, usePages} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import PostCardWrapper from "./PostCardWrapper";
import MentionedTextComponent from "../MentionedTextComponent";
import {mentionTags} from "../../controllers/mentionTypes";
import PostButtons from "./PostButtons";
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
            handleClickPost={handleClickPost}
        >
            <CardHeader
                classes={{content: styles.cardContent, subheader: styles.cardSubheader}}
                className={[
                    styles.header,
                ].join(" ")}
                avatar={<Link
                    className={styles.avatar}
                    onClick={evt => evt.stopPropagation()}
                    to={pages.user.route + postData.uid}
                >
                    <AvatarView
                        className={level > 1 ? styles.avatarSmallest : ""}
                        image={userData.image}
                        initials={userData.initials}
                        verified={true}
                    />
                </Link>}
                title={<Grid container>
                    <Grid
                        className={styles.userName}
                        item
                    >
                        <Link
                            className={[styles.label].join(" ")}
                            onClick={evt => evt.stopPropagation()}
                            to={pages.user.route + userData.id}
                        >{userData.name}</Link>
                    </Grid>
                    <Grid
                        item
                        className={styles.date}
                        title={new Date(postData.created).toLocaleString()}>
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
                        ref={ancillaryRef}
                    />
                    {postData.images && <Grid
                        className={styles.cardImage}
                        container
                    >
                        <PostMedia
                            images={styles.images}
                            clickable={disableClick}
                        />
                    </Grid>}
                    <Grid container alignItems={"flex-end"} justifyContent={"flex-end"}>
                        {postsAllowEdit && postData.edit && <Grid item xs className={styles.date}>
                            Edited {toDateString(postData.editOf("last").timestamp)}
                        </Grid>}
                        {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
                    </Grid>
                </>}
            />
        </PostCardWrapper>
        {level === undefined && postsRotateReplies === "inside" &&
        <RotatingReplies {...props} postId={postData.id}/>}
    </Card>
});
