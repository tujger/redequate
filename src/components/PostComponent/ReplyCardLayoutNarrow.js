import React from "react";
import {Link} from "react-router-dom";
import PostBody from "./PostBody";
import {usePages, useWindowData} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import PostButtons from "./PostButtons";
import PostMenu from "./PostMenu";
import UserName from "../../controls/UserName/UserName";
import cardStyles from "./styles/PostComponent.module.css";
import replyStyles from "./styles/PostReplies.module.css";
import textStyles from "./styles/PostText.module.css";

export default React.forwardRef((props, ref) => {
    const {className, disableClick, disableButtons, level, pattern, postData, style, userData, highlighted} = props;
    const pages = usePages();
    const windowData = useWindowData();
    const ancillaryRef = React.useRef();

    return <div className={[
        cardStyles.card,
        pattern && cardStyles[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`],
        highlighted && cardStyles.cardHighlighted,
        className,
    ].filter(Boolean).join(" ")} ref={ref} style={style}>
        <div className={[cardStyles.cardHeader, cardStyles.cardHeaderWithLabel, replyStyles.reply].join(" ")}>
            <Link className={level > 1 ? cardStyles.avatarSmallest : cardStyles.avatarSmall} onClick={evt => evt.stopPropagation()} to={pages.user.route + postData.uid}>
                <AvatarView className={level > 1 ? cardStyles.avatarSmallest : cardStyles.avatarSmall} image={userData.image} initials={userData.initials} verified={true}/>
            </Link>
            <div className={cardStyles.cardContent}>
                <div className={cardStyles.layout}>
                    <div className={[cardStyles.layout, cardStyles.userName].join(" ")}>
                        <UserName className={textStyles.label} id={userData.id}>{userData.name}</UserName>
                    </div>
                    {windowData.isNarrow() && <div className={[cardStyles.layout, cardStyles.layoutGrow].join(" ")}/>}
                    <PostMenu {...props}/>
                    <div className={[cardStyles.layout, cardStyles.date].join(" ")} title={new Date(postData.created).toLocaleString()}>{toDateString(postData.created)}</div>
                </div>
                <PostBody {...props} ref={ancillaryRef} disableClick={!disableClick}/>
                {postData.images && <div className={[cardStyles.layout, cardStyles.cardImage].join(" ")}>
                    <PostMedia images={postData.images} mosaic/>
                </div>}
                {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
            </div>
        </div>
    </div>
});
