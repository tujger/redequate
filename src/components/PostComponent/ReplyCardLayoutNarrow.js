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

export default React.forwardRef((props, ref) => {
    const {classes = {}, className, disableClick, disableButtons, level, pattern, postData, userData, highlighted} = props;
    const pages = usePages();
    const windowData = useWindowData();
    const ancillaryRef = React.useRef();

    return <div className={[classes.card, pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "", highlighted ? classes.cardHighlighted : "", className].join(" ")} ref={ref}>
        <div className={[classes.cardHeader, classes.cardHeaderWithLabel, classes.post, classes.reply].join(" ")}>
            <Link className={level > 1 ? classes.avatarSmallest : classes.avatarSmall} onClick={evt => evt.stopPropagation()} to={pages.user.route + postData.uid}>
                <AvatarView className={level > 1 ? classes.avatarSmallest : classes.avatarSmall} image={userData.image} initials={userData.initials} verified={true}/>
            </Link>
            <div className={classes.cardContent}>
                <div className={classes.layout}>
                    <div className={[classes.layout, classes.userName].join(" ")}>
                        <UserName className={classes.label} id={userData.id}>{userData.name}</UserName>
                    </div>
                    {windowData.isNarrow() && <div className={[classes.layout, classes.layoutGrow].join(" ")}/>}
                    <PostMenu {...props}/>
                    <div className={[classes.layout, classes.date].join(" ")} title={new Date(postData.created).toLocaleString()}>{toDateString(postData.created)}</div>
                </div>
                <PostBody {...props} ref={ancillaryRef} disableClick={!disableClick}/>
                {postData.images && <div className={[classes.layout, classes.cardImage].join(" ")}>
                    <PostMedia images={postData.images} mosaic/>
                </div>}
                {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
            </div>
        </div>
    </div>
});
