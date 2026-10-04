import React from "react";
import {Link} from "react-router-dom";
import chatStyles from "../../chat/styles/ChatsItem.module.css";
import {toDateString} from "../../controllers/DateFormat";
import {cacheDatas, useMetaInfo, usePages} from "../../controllers/General";
import {mentionTags} from "../../controllers/mentionTypes";
import mentionStyles from "../../controllers/styles/MentionTypes.module.css";
import UserName from "../../controls/UserName/UserName";
import AvatarView from "../AvatarView";
import ListItemComponent from "../ListItemComponent";
import MentionedTextComponent from "../MentionedTextComponent";
import PostBody from "./PostBody";
import PostButtons from "./PostButtons";
import PostCardWrapper from "./PostCardWrapper";
import PostMedia from "./PostMedia";
import PostMenu from "./PostMenu";
import RotatingReplies from "./RotatingReplies";
import cardStyles from "./styles/PostComponent.module.css";
import textStyles from "./styles/PostText.module.css";

export default React.forwardRef((props, ref) => {
    const {
        className,
        disableClick,
        disableButtons,
        handleClickPost,
        level,
        pattern,
        postData,
        style,
        userData,
        highlighted
    } = props;
    const pages = usePages();
    const {settings = {}} = useMetaInfo() || {};
    const {postsRotateReplies, postsAllowEdit} = settings;
    const ancillaryRef = React.useRef();

    return <ListItemComponent
        avatar={<Link className={cardStyles.avatar} onClick={evt => evt.stopPropagation()}
                      to={pages.user.route + postData.uid}>
            <AvatarView className={level > 1 ? cardStyles.avatarSmallest : cardStyles.avatar}
                        image={userData.image} initials={userData.initials} verified={true}/>
        </Link>}
        className={[
            highlighted && cardStyles.cardHighlighted,
        ].filter(Boolean).join(" ")}
        menu={<PostMenu {...props}/>}
        onClick={handleClickPost}
        subtitle={postData.targetTag && <div className={cardStyles.layout}>
                - posted to <MentionedTextComponent mentions={[{
                ...mentionTags,
                className: [mentionTags.className, mentionStyles.target].join(" "),
                displayTransform: (id, display) => display
            }]} tokens={[postData.targetTag]}/>
            </div>}
        timestamp={postData.created}
        title={<UserName className={textStyles.label} id={userData.id}>{userData.name}</UserName>}
        // onKeyDown={handleKeyDown}
        variant={"contained"}
    >
        <PostBody {...props} disableClick={!disableClick} ref={ancillaryRef}/>
        {postData.images && <div className={[cardStyles.layout, cardStyles.cardImage].join(" ")}>
            <PostMedia images={postData.images} clickable={disableClick}/>
        </div>}
        <div className={[cardStyles.layout, cardStyles.cardActions].join(" ")}>
            {postsAllowEdit && postData.edit && <div
                className={[cardStyles.layout, cardStyles.date].join(" ")}>Edited {toDateString(postData.editOf("last").timestamp)}</div>}
            {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
        </div>
        {level === undefined && postsRotateReplies === "inside" && <RotatingReplies {...props} postId={postData.id}/>}
    </ListItemComponent>

    return <div className={[
        cardStyles.card,
        pattern && cardStyles[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`],
        highlighted && cardStyles.cardHighlighted,
        className,
    ].filter(Boolean).join(" ")} ref={ref} style={style}>
        <PostCardWrapper disableClick={disableClick} handleClickPost={handleClickPost}>
            <div className={cardStyles.cardHeader}>
                <Link className={cardStyles.avatar} onClick={evt => evt.stopPropagation()}
                      to={pages.user.route + postData.uid}>
                    <AvatarView className={level > 1 ? cardStyles.avatarSmallest : cardStyles.avatar}
                                image={userData.image} initials={userData.initials} verified={true}/>
                </Link>
                <div className={cardStyles.cardContent}>
                    <div className={cardStyles.layout}>
                        <UserName className={textStyles.label} id={userData.id}>{userData.name}</UserName>
                        <div className={[cardStyles.layout, cardStyles.date].join(" ")}
                             title={new Date(postData.created).toLocaleString()}>{toDateString(postData.created)}</div>
                        {postData.targetTag && <div className={cardStyles.layout}>
                            - posted to <MentionedTextComponent mentions={[{
                            ...mentionTags,
                            className: [mentionTags.className, mentionStyles.target].join(" "),
                            displayTransform: (id, display) => display
                        }]} tokens={[postData.targetTag]}/>
                        </div>}
                        <PostMenu {...props}/>
                    </div>
                    <PostBody {...props} disableClick={!disableClick} ref={ancillaryRef}/>
                    {postData.images && <div className={[cardStyles.layout, cardStyles.cardImage].join(" ")}>
                        <PostMedia images={postData.images} clickable={disableClick}/>
                    </div>}
                    <div className={[cardStyles.layout, cardStyles.cardActions].join(" ")}>
                        {postsAllowEdit && postData.edit && <div
                            className={[cardStyles.layout, cardStyles.date].join(" ")}>Edited {toDateString(postData.editOf("last").timestamp)}</div>}
                        {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
                    </div>
                </div>
            </div>
        </PostCardWrapper>
        {level === undefined && postsRotateReplies === "inside" && <RotatingReplies {...props} postId={postData.id}/>}
    </div>
});
