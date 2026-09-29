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
import cardStyles from "./styles/PostComponent.module.css";
import textStyles from "./styles/PostText.module.css";
import mentionStyles from "../../controllers/styles/MentionTypes.module.css";

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
        highlighted,
    } = props;
    const pages = usePages();
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {postsRotateReplies, postsAllowEdit} = settings;
    const ancillaryRef = React.useRef();

    return <div
        className={[
            cardStyles.card,
            pattern && cardStyles[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`],
            highlighted && cardStyles.cardHighlighted,
            className,
        ].filter(Boolean).join(" ")}
        ref={ref}
        style={style}
    >
        <PostCardWrapper
            disableClick={disableClick}
            handleClickPost={handleClickPost}>
            <div className={[cardStyles.cardHeader, cardStyles.cardHeaderWithLabel].join(" ")}>
                <Link
                    className={cardStyles.avatarSmall}
                    onClick={evt => evt.stopPropagation()}
                    to={pages.user.route + postData.uid}
                >
                    <AvatarView
                        className={cardStyles.avatarSmall}
                        image={userData.image}
                        initials={userData.initials}
                        verified={true}
                    />
                </Link>
                <div className={cardStyles.cardContent}>
                    <div className={[cardStyles.layout, cardStyles.inline, cardStyles.cardTitle].join(" ")}>
                        <UserName className={textStyles.label} id={userData.id}>
                            {userData.name}
                        </UserName>
                        {postData.targetTag && <div
                            className={[cardStyles.layout, cardStyles.layoutGrow].join(" ")}
                        >
                            posted to <MentionedTextComponent
                                mentions={[
                                    {
                                        ...mentionTags,
                                        className: [mentionTags.className, mentionStyles.target].join(" "),
                                        displayTransform: (id, display) => display,
                                    }
                                ]}
                                tokens={[postData.targetTag]}
                            />
                        </div>}
                    </div>
                    <div
                        className={[cardStyles.layout, cardStyles.cardSubheader, cardStyles.date].join(" ")}
                        title={new Date(postData.created).toLocaleString()}
                    >
                        {toDateString(postData.created)}
                    </div>
                </div>
                <PostMenu {...props}/>
            </div>
            <PostBody
                {...props}
                ref={ancillaryRef}
                disableClick={!disableClick}
            />
        </PostCardWrapper>
        {postData.images && <div className={[cardStyles.layout, cardStyles.cardImage].join(" ")}>
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
