import React from "react";
import {Link} from "react-router-dom";
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
import UserName from "../../controls/UserName/UserName";

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
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {postsRotateReplies, postsAllowEdit} = settings;
    const ancillaryRef = React.useRef();

    return <div
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
            <div className={[classes.cardHeader, classes.cardHeaderWithLabel, classes.post].join(" ")}>
                <Link
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
                </Link>
                <div className={classes.cardContent}>
                    <div className={[classes.layout, classes.inline, classes.cardTitle].join(" ")}>
                        <div className={[classes.layout, classes.userName].join(" ")}>
                            <UserName
                                className={classes.label}
                                id={userData.id}
                            >{userData.name}</UserName>
                        </div>
                        <PostMenu {...props}/>
                        {postData.targetTag && <div className={[classes.layout, classes.layoutGrow].join(" ")}>
                            posted to <MentionedTextComponent
                            mentions={[{
                                ...mentionTags,
                                displayTransform: (id, display) => display,
                                style: {fontWeight: "bold"}
                            }]}
                            tokens={[postData.targetTag]}
                        /></div>}
                    </div>
                    <div className={[classes.layout, classes.cardSubheader, classes.date].join(" ")}
                         title={new Date(postData.created).toLocaleString()}>
                        {toDateString(postData.created)}
                    </div>
                </div>
            </div>
            <PostBody
                {...props}
                ref={ancillaryRef}
                disableClick={!disableClick}
            />
        </PostCardWrapper>
        {postData.images && <div className={[classes.layout, classes.cardImage].join(" ")}>
            <PostMedia
                images={postData.images}
                mosaic
            />
        </div>}
        {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
        {level === undefined && postsRotateReplies === "inside" &&
        <RotatingReplies {...props} postId={postData.id}/>}
    </div>
})
