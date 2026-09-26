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
    const {classes = {}, className, disableClick, disableButtons, handleClickPost, level, pattern, postData, userData, highlighted} = props;
    const pages = usePages();
    const {settings = {}} = useMetaInfo() || {};
    const {postsRotateReplies, postsAllowEdit} = settings;
    const ancillaryRef = React.useRef();

    return <div className={[classes.card, pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "", highlighted ? classes.cardHighlighted : "", className].join(" ")} ref={ref}>
        <PostCardWrapper classes={classes} disableClick={disableClick} handleClickPost={handleClickPost}>
            <div className={[classes.cardHeader, classes.post].join(" ")}>
                <Link className={classes.avatar} onClick={evt => evt.stopPropagation()} to={pages.user.route + postData.uid}>
                    <AvatarView className={level > 1 ? classes.avatarSmallest : classes.avatar} image={userData.image} initials={userData.initials} verified={true}/>
                </Link>
                <div className={classes.cardContent}>
                    <div className={classes.layout}>
                        <div className={[classes.layout, classes.userName].join(" ")}>
                            <UserName className={classes.label} id={userData.id}>{userData.name}</UserName>
                        </div>
                        <div className={[classes.layout, classes.date].join(" ")} title={new Date(postData.created).toLocaleString()}>{toDateString(postData.created)}</div>
                        {postData.targetTag && <div className={classes.layout}>
                            - posted to <MentionedTextComponent mentions={[{...mentionTags, displayTransform: (id, display) => display, style: {fontWeight: "bold"}}]} tokens={[postData.targetTag]}/>
                        </div>}
                        <PostMenu {...props}/>
                    </div>
                    <PostBody {...props} disableClick={!disableClick} ref={ancillaryRef}/>
                    {postData.images && <div className={[classes.layout, classes.cardImage].join(" ")}>
                        <PostMedia images={postData.images} clickable={disableClick}/>
                    </div>}
                    <div className={[classes.layout, classes.cardActions].join(" ")}>
                        {postsAllowEdit && postData.edit && <div className={[classes.layout, classes.date].join(" ")}>Edited {toDateString(postData.editOf("last").timestamp)}</div>}
                        {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
                    </div>
                </div>
            </div>
        </PostCardWrapper>
        {level === undefined && postsRotateReplies === "inside" && <RotatingReplies {...props} postId={postData.id}/>}
    </div>
});
